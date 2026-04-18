"""Second Voice — LiveKit voice agent worker.

Runs an empathic conversational check-in:

  * Greets the user and asks the daily reflective prompt.
  * Listens via Speechmatics STT, replies via LiveKit Inference TTS.
  * Captures the user's audio in parallel for off-line biomarker analysis.
  * On session end, posts the captured audio to the voice-service and the
    resulting transcript + biomarkers to the backend.

Run locally during development:

    cd voice-agent
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python agent.py download-files   # one-time: VAD + turn-detector models
    python agent.py dev              # registers with LiveKit Cloud + waits
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RoomInputOptions,
    cli,
)
from livekit.plugins import silero, speechmatics
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from audio_capture import UserAudioCapture
from finalise import FinalisationError, finalise_session

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("second-voice.agent")


DAILY_PROMPTS = [
    "How are you doing today, in your own words?",
    "What feels heaviest right now, and what feels lighter?",
    "Describe today's energy. What helped, what didn't?",
    "How did you sleep, and how does that show up today?",
    "What's been on your mind that you haven't said out loud yet?",
    "How does your body feel as you sit here?",
    "If today had a colour, what would it be, and why?",
]


def prompt_for_today() -> str:
    today = dt.date.today()
    day_of_year = today.timetuple().tm_yday
    return DAILY_PROMPTS[day_of_year % len(DAILY_PROMPTS)]


def extract_user_metadata(
    ctx: JobContext,
) -> Tuple[Optional[str], Optional[str], List[Dict[str, Any]]]:
    """Pull `{userId, displayName, questions}` from the room metadata that the
    backend baked into the agent dispatch when minting the LiveKit token. Falls
    back to the job metadata if the room metadata is missing (defensive — both
    should match).

    `questions` is the PHQ-9 / GAD-7 items the agent should weave in this
    session. Empty list if absent (the agent then runs as a pure reflective
    check-in with no self-report items).
    """
    candidates = []
    job_meta = getattr(ctx.job, "metadata", None)
    if job_meta:
        candidates.append(("job.metadata", job_meta))
    room_meta = getattr(ctx.room, "metadata", None)
    if room_meta:
        candidates.append(("room.metadata", room_meta))

    for source, raw in candidates:
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            logger.debug("could not parse %s as json: %r", source, raw)
            continue
        user_id = parsed.get("userId")
        display = parsed.get("displayName")
        questions = parsed.get("questions") or []
        if user_id:
            logger.info(
                "resolved user from %s: userId=%s displayName=%r questions=%s",
                source,
                user_id,
                display,
                [q.get("id") for q in questions if isinstance(q, dict)],
            )
            return user_id, display, questions

    logger.warning("no userId found in job/room metadata — finalisation will be skipped")
    return None, None, []


SYSTEM_INSTRUCTIONS = """You are Second Voice — a calm, warm, human-feeling
voice companion for people on NHS mental-health waiting lists. You sound like
a thoughtful friend who happens to be a great listener, not a chatbot, not a
clinician.

This is a spoken conversation, not a form. Speak naturally, as a person would.

How you talk:
- Short, natural sentences. Use contractions ("you're", "I've", "that's").
  Plain spoken English.
- Use brief acknowledgements before responding when it feels right — things
  like "mhm", "yeah", "right", "I hear you", "that makes sense". Don't overdo
  it; sprinkle them, don't stuff them.
- Always reflect back what you heard in your own words before moving on.
  People feel heard when they hear themselves echoed.
- Ask one open follow-up at a time. Be genuinely curious. Go a layer deeper
  than you think you should: "what does that look like, day to day?", "what's
  underneath that, do you think?", "and how long has that been with you?",
  "what would it feel like if that lifted, even a little?"
- It's okay to sit with silence. If they pause, give them a beat. If they
  trail off, gently nudge: "take your time", or "do you want to say more
  about that?"
- Vary your phrasing every turn. Never sound scripted. Never use the same
  opener twice in one conversation.
- No markdown, no lists, no asterisks, no headings, no emojis. This is voice,
  not text.

Shape of the conversation (aim for roughly 5-8 minutes, 8-12 turns — but
follow the user, not a stopwatch):

1. Open with a soft, personal greeting. Use their name if you have it. Do not
   introduce yourself as an AI or explain what a check-in is — they know.
2. Ease into today's reflective prompt, but say it in your own words so it
   flows out of the greeting. Don't read it like a script. Today's prompt is:
   "{daily_prompt}"
3. Listen fully. Reflect. Ask a follow-up that goes one layer deeper than
   what they just said.
4. Across the conversation you MUST ask every single self-report item
   listed below — this is non-negotiable, it's the whole reason we have
   data. Weave them in naturally; don't blast them as a list. The moment
   the user gives you ANY answer that maps to a 0-3 PHQ/GAD score for one
   of the items, you MUST IMMEDIATELY call the
   `record_questionnaire_answer` tool with the exact `question_id` from
   the list, the 0-3 `score`, and the verbatim words they used as
   `raw_answer`. Do this BEFORE you reply with your next sentence. The
   tool call is silent — the user won't hear it. If you skip the tool
   call, the data is lost forever and the whole product fails.
5. Keep the conversation moving across several turns. Follow whatever thread
   they're actually pulling on — feelings, sleep, body, energy, what's
   behind it, what helped, what didn't. Don't run a checklist.
6. Before you can call `end_check_in`, BOTH of these must be true:
   (a) the conversation has reached a natural close (they say things like
   "yeah, that's about it", "I think that's all", they sound wrapped up),
   AND
   (b) you have called `record_questionnaire_answer` once for EVERY item
   in the self-report list below.
   If you've reached a natural close but some items are still unrecorded,
   gently and directly ask the remaining ones — one at a time, with a
   brief lead-in like "before we wrap, can I quickly ask about…" — record
   each answer, then offer the warm sign-off and call `end_check_in`.
   The sign-off can be: "Thanks for sitting with this with me. Your
   trajectory will update from this conversation. Take it gently today."

Self-report items for THIS session (ask each one, then call the tool):
{questionnaire_block}

How to score (0-3, the standard PHQ-9/GAD-7 response set, asking about the
last two weeks):
- 0 = "Not at all" — they say things like "no, never", "not really", "fine".
- 1 = "Several days" — "a few times", "now and then", "occasionally", "a bit".
- 2 = "More than half the days" — "most days", "a lot of the time", "often".
- 3 = "Nearly every day" — "every day", "constantly", "all the time".
If they're vague, ask one short clarifier — "would you say a few days, or
more like most days?" — then map it. NEVER skip the tool call: even if you
think the answer is obvious, log it. The tool call is silent — they won't
hear it.

When NOT to end the call:
- After only one or two turns, unless the user explicitly asks to stop.
- Mid-thought. If they trailed off or gave a one-word answer, stay with them
  and ask a gentler follow-up.
- Just because you've asked the daily prompt. That's the opener, not the
  whole thing.
- Before you've recorded an answer for every self-report item above. The
  `end_check_in` tool will reject your call if items are still unrecorded
  — finish them first.

Safety (this overrides everything else):
- You are not a clinician. Never diagnose, never give medical advice, never
  recommend treatment or medication.
- If the user mentions self-harm, suicide, or wanting to hurt themselves or
  someone else, drop everything else and calmly say: "What you're describing
  sounds really hard, and I want you to talk to someone who can be with you
  in this right now. Please call the Samaritans on 116 123 — they're free,
  they're 24/7, and they will listen." Stay with them for one more gentle
  turn to make sure they heard you, then call `end_check_in`.

You are warm. You are unhurried. You sound like you mean it.
"""


def render_questionnaire_block(questions: List[Dict[str, Any]]) -> str:
    """Render the per-session PHQ-9/GAD-7 items as a numbered block the LLM
    can absorb into the system prompt. Each entry shows the canonical id (so
    the tool call is unambiguous), the instrument, and the soft voice prompt
    the agent should adapt in conversation.
    """
    if not questions:
        return (
            "  (none — this session is purely reflective; no tool calls needed)"
        )
    lines = []
    for i, q in enumerate(questions, start=1):
        if not isinstance(q, dict):
            continue
        qid = q.get("id", "?")
        instrument = q.get("instrument", "?").upper()
        prompt = q.get("voicePrompt") or q.get("text") or ""
        lines.append(f'  {i}. [{instrument}] question_id="{qid}"')
        lines.append(f'     suggested phrasing: "{prompt}"')
    return "\n".join(lines)


class CheckInAgent(Agent):
    def __init__(
        self,
        daily_prompt: str,
        capture: UserAudioCapture,
        display_name: Optional[str] = None,
        questions: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        questions = questions or []
        instructions = SYSTEM_INSTRUCTIONS.format(
            daily_prompt=daily_prompt,
            questionnaire_block=render_questionnaire_block(questions),
        )
        if display_name:
            instructions += (
                f"\n\nThe person you're speaking with is called {display_name}. "
                "Use their first name once or twice across the conversation when it "
                "feels warm and natural — never in a way that sounds robotic."
            )
        super().__init__(instructions=instructions)
        self._capture = capture
        self.user_requested_end = asyncio.Event()
        # Set of question_ids we expect to record this session, so we can
        # detect and warn if the LLM tries to wrap up early.
        self._expected_question_ids = {
            q.get("id") for q in questions if isinstance(q, dict) and q.get("id")
        }
        self._recorded_answers: Dict[str, Dict[str, Any]] = {}

    @property
    def recorded_answers(self) -> List[Dict[str, Any]]:
        """The answer payload to ship to the backend in the finalise call.

        Shape matches the backend's `QuestionnaireAnswerDto`:
            [{"questionId": str, "score": 0-3, "rawAnswer": str}]
        """
        return [
            {
                "questionId": qid,
                "score": entry["score"],
                "rawAnswer": entry.get("rawAnswer"),
            }
            for qid, entry in self._recorded_answers.items()
        ]

    @property
    def coverage(self) -> Tuple[int, int]:
        return len(self._recorded_answers), len(self._expected_question_ids)

    @agents.function_tool()
    async def end_check_in(self) -> str:
        """Call this when the user has finished their check-in. WILL REFUSE
        to end the call if any of the self-report items in the system
        prompt have not yet been recorded via
        `record_questionnaire_answer` — finish them first.
        """
        recorded, expected = self.coverage
        if expected > 0 and recorded < expected:
            missing = sorted(
                self._expected_question_ids - set(self._recorded_answers.keys())
            )
            logger.warning(
                "end_check_in BLOCKED: questionnaire coverage %d/%d (missing=%s)",
                recorded,
                expected,
                missing,
            )
            # Return a message the LLM will see and act on — telling it
            # exactly which items are still outstanding so it can ask them.
            return (
                f"NOT ENDING YET. You still need to ask and record these "
                f"items before wrapping up: {', '.join(missing)}. "
                "Ask them gently one at a time, call "
                "record_questionnaire_answer for each, then call "
                "end_check_in again."
            )
        logger.info(
            "agent invoked end_check_in tool (questionnaire coverage %d/%d)",
            recorded,
            expected,
        )
        self.user_requested_end.set()
        return "ok, ending check-in"

    @agents.function_tool()
    async def record_questionnaire_answer(
        self,
        question_id: str,
        score: int,
        raw_answer: Optional[str] = None,
    ) -> str:
        """MANDATORY: Call this every time the user gives you an answer
        that maps to one of the self-report items in your system prompt.
        Call it BEFORE you reply to them — the tool is silent, the user
        won't hear it. Skipping it loses the data forever and the product
        fails. Do not "remember" answers in your head and batch them at
        the end; record each one the moment you have it.

        Args:
            question_id: EXACT id from the system prompt list, e.g.
                "phq9.3" or "gad7.5". Do not invent ids.
            score: 0-3 on the standard PHQ/GAD scale.
                0 = Not at all (e.g. "no", "not really", "never").
                1 = Several days (e.g. "a few times", "occasionally", "a bit").
                2 = More than half the days (e.g. "most days", "often", "a lot").
                3 = Nearly every day (e.g. "every day", "constantly", "all the time").
                If the user's answer is vague, ask one short clarifier
                first ("would you say a few days or more like most days?")
                then call this with the mapped score.
            raw_answer: The verbatim words the user said, for audit. Quote
                them, don't paraphrase.
        """
        # Defensive normalisation — LLMs sometimes hand back floats / strings.
        try:
            score_int = int(round(float(score)))
        except (TypeError, ValueError):
            logger.warning(
                "record_questionnaire_answer: non-numeric score=%r for %s",
                score,
                question_id,
            )
            return "score must be 0, 1, 2, or 3"
        if score_int < 0 or score_int > 3:
            logger.warning(
                "record_questionnaire_answer: out-of-range score=%d for %s",
                score_int,
                question_id,
            )
            return "score must be 0, 1, 2, or 3"
        if question_id not in self._expected_question_ids:
            logger.warning(
                "record_questionnaire_answer: unexpected id=%r (expected one of %s)",
                question_id,
                sorted(self._expected_question_ids),
            )
            # Still record it — the backend will validate against the canonical
            # bank and drop unknown ids defensively.
        self._recorded_answers[question_id] = {
            "score": score_int,
            "rawAnswer": (raw_answer or "").strip() or None,
        }
        recorded, expected = self.coverage
        logger.info(
            "recorded answer %s=%d (%d/%d items captured)",
            question_id,
            score_int,
            recorded,
            expected,
        )
        return f"recorded ({recorded}/{expected})"


server = AgentServer()


@server.rtc_session(agent_name=os.environ.get("LIVEKIT_AGENT_NAME", "second-voice-checkin"))
async def entrypoint(ctx: JobContext) -> None:
    daily_prompt = prompt_for_today()
    user_id, display_name, questions = extract_user_metadata(ctx)
    logger.info(
        "job started room=%s user=%s prompt=%r questions=%s",
        ctx.room.name,
        user_id or "<unknown>",
        daily_prompt,
        [q.get("id") for q in questions if isinstance(q, dict)],
    )

    capture = UserAudioCapture(ctx.room)
    capture.attach()

    # Pre-declare so the shutdown closure can reference it safely even if the
    # entrypoint crashes before the agent is constructed below.
    agent: Optional["CheckInAgent"] = None

    # Register the audio analysis pipeline as a shutdown callback so it runs
    # AFTER the entrypoint exits. The entrypoint has a hard 15s timeout
    # imposed by the LiveKit Agents runtime once the room shuts down — but
    # shutdown callbacks run in a separate phase with no such cap, which is
    # exactly what we need for the multi-second voice-service + Thymia hop.
    async def _on_shutdown(reason: str) -> None:
        logger.info("shutdown callback firing (reason=%r)", reason)
        captured = await capture.stop()
        logger.info(
            "captured %.2fs of audio for room %s",
            captured.duration_seconds,
            ctx.room.name,
        )

        if not captured.has_audio:
            logger.warning(
                "no user audio captured; skipping voice-service + backend post"
            )
            return
        if not user_id:
            logger.error(
                "captured %.2fs of audio but no userId in room metadata — "
                "refusing to post a check-in to an unknown account.",
                captured.duration_seconds,
            )
            return

        wav_bytes = captured.to_wav_bytes()
        debug_root = Path(
            os.environ.get("AGENT_AUDIO_DEBUG_DIR", "/tmp/second-voice-agent")
        )
        try:
            debug_root.mkdir(parents=True, exist_ok=True)
            (debug_root / f"{ctx.room.name}.wav").write_bytes(wav_bytes)
        except OSError as err:
            logger.debug("could not save debug wav: %s", err)

        questionnaire_responses = agent.recorded_answers if agent else []
        try:
            result = await finalise_session(
                user_id=user_id,
                session_id=ctx.room.name,
                wav_bytes=wav_bytes,
                duration_seconds=captured.duration_seconds,
                questionnaire_responses=questionnaire_responses,
            )
            logger.info(
                "check-in finalised id=%s divergence=%s questionnaire_items=%d",
                result.get("checkinId"),
                result.get("divergenceDetected"),
                len(questionnaire_responses),
            )
        except FinalisationError as err:
            logger.error("finalisation failed: %s", err)
        except Exception as err:  # pragma: no cover
            logger.exception("unexpected finalisation error: %s", err)

    ctx.add_shutdown_callback(_on_shutdown)

    llm_model = os.environ.get("AGENT_LLM_MODEL", "openai/gpt-4o-mini")
    tts_model = os.environ.get(
        "AGENT_TTS_MODEL",
        "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    )

    session = AgentSession(
        stt=speechmatics.STT(language="en"),
        llm=llm_model,
        tts=tts_model,
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    agent = CheckInAgent(
        daily_prompt=daily_prompt,
        capture=capture,
        display_name=display_name,
        questions=questions,
    )

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(),
    )

    # Open the conversation. We deliberately don't tell the LLM to read the
    # prompt verbatim — we want it to flow naturally out of the greeting.
    name_clause = (
        f"You know their name is {display_name} — use it warmly, like a friend."
        if display_name
        else "You don't know their name yet — just greet them warmly."
    )
    await session.generate_reply(
        instructions=(
            "Open the conversation. One short, warm greeting (don't introduce "
            f"yourself as an AI). {name_clause} Then ease into today's reflective "
            f"prompt — phrase it in your own natural words so it flows from the "
            f"greeting, don't recite it. The prompt to weave in is: "
            f"\"{daily_prompt}\". Keep the whole opener to two or three short "
            "spoken sentences, then stop and listen."
        ),
    )

    # Wait until either the agent decides the conversation is done, the user
    # disconnects, or the safety timeout fires. We give the conversation room
    # to breathe — a real check-in can easily take 5-6 minutes.
    SAFETY_TIMEOUT_SEC = 480  # 8 minutes hard cap
    disconnected = asyncio.Event()

    def _on_participant_disconnected(_p) -> None:
        logger.info("user disconnected, finalising session")
        disconnected.set()

    ctx.room.on("participant_disconnected", _on_participant_disconnected)

    try:
        await asyncio.wait_for(
            asyncio.wait(
                [
                    asyncio.create_task(agent.user_requested_end.wait()),
                    asyncio.create_task(disconnected.wait()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            ),
            timeout=SAFETY_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        logger.warning("session hit safety timeout (%ds)", SAFETY_TIMEOUT_SEC)

    # We DON'T do the audio analysis here — finalisation lives in the
    # shutdown callback registered above, which runs in a separate phase
    # without the 15-second entrypoint cancellation window. The entrypoint
    # just signals shutdown and exits cleanly.
    await session.aclose()
    logger.info(
        "agent session closed for room %s, scheduling shutdown",
        ctx.room.name,
    )
    ctx.shutdown(reason="check-in complete")


if __name__ == "__main__":
    cli.run_app(server)
