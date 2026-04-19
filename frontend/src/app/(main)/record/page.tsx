'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { ArrowLeft, Loader2, Mic, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConversationRoom } from '@/components/recording/ConversationRoom';
import { FinalisingProgress } from '@/components/recording/FinalisingProgress';
import {
  enhancedApi,
  useIssueSessionTokenMutation,
  useLazyGetTrajectoryQuery,
} from '@/managers/apiManager';
import { getPromptForDate } from '@/lib/constants';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { resetRecording, setRecordingStatus } from '@/managers/uiSlice';

type SessionCreds = {
  url: string;
  token: string;
  roomName: string;
};

type Phase = 'idle' | 'connecting' | 'active' | 'finalising';

/**
 * Visual budget for the post-call progress UI. This is the "expected"
 * duration we show to the user as a countdown — a hint, not a hard timeout.
 * The actual completion is decided by polling the trajectory endpoint until
 * a new check-in appears.
 *
 * Pipeline reference (agent worker, after disconnect):
 *   1. Flush captured PCM → WAV          (<100ms)
 *   2. POST to voice-service /analyze    (Speechmatics ~3-6s + Thymia ~2-5s)
 *   3. POST result → backend /from-session (<200ms)
 */
const FINALISATION_BUDGET_MS = 12_000;
/**
 * Hard ceiling — if the new check-in still hasn't landed by this point,
 * route to /trajectory anyway. The user shouldn't be stuck on this screen.
 */
const FINALISATION_HARD_TIMEOUT_MS = 25_000;
/** How often we poll the trajectory endpoint waiting for the new point. */
const POLL_INTERVAL_MS = 1_500;

export default function RecordPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [phase, setPhase] = useState<Phase>('idle');
  const [creds, setCreds] = useState<SessionCreds | null>(null);
  const [finalisationCompleted, setFinalisationCompleted] = useState(false);
  const [issueToken, { isLoading: isIssuing }] = useIssueSessionTokenMutation();
  const [pollTrajectory] = useLazyGetTrajectoryQuery();
  const today = useMemo(() => new Date(), []);
  const prompt = useMemo(() => getPromptForDate(today), [today]);
  const finalisedRef = useRef(false);
  // Snapshot of the trajectory point count at the moment we start the call.
  // We poll for `total > baselineTotal` to know the agent has persisted the
  // new check-in to the backend.
  const baselineTotalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      dispatch(resetRecording());
    };
  }, [dispatch]);

  // Snapshot the current trajectory size once we have a session — this is
  // what we'll poll against after the user ends the call.
  useEffect(() => {
    if (phase !== 'connecting' && phase !== 'active') return;
    if (baselineTotalRef.current !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await pollTrajectory().unwrap();
        if (!cancelled) {
          baselineTotalRef.current = snapshot.total ?? 0;
        }
      } catch {
        // Non-fatal — if the snapshot fails we'll just fall back to the
        // hard timeout when finalising. The UX still works.
        baselineTotalRef.current = baselineTotalRef.current ?? 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, pollTrajectory]);

  const startCheckIn = async () => {
    setPhase('connecting');
    dispatch(setRecordingStatus('recording'));

    // Step 1: surface the browser microphone permission prompt RIGHT HERE,
    // tied to the user's click. If we let <LiveKitRoom audio> ask for the mic
    // after async work, browsers (especially Safari/Brave) treat it as a
    // non-gesture and either silently deny or throw "Permission denied" — and
    // then no audio ever flows to the agent (we end up with 0s captured and
    // nothing lands in the trajectory).
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      toast.error(
        denied
          ? 'Microphone permission was blocked. Click the lock icon in your address bar, allow microphone access for this site, then try again.'
          : 'Could not access your microphone. Make sure no other app is using it and try again.',
      );
      setPhase('idle');
      dispatch(resetRecording());
      return;
    } finally {
      // We only needed the stream to trigger the permission prompt — LiveKit
      // will request its own track. Release ours so we don't hold the device.
      micStream?.getTracks().forEach((t) => t.stop());
    }

    try {
      const result = await issueToken().unwrap();
      setCreds({
        url: result.url,
        token: result.token,
        roomName: result.roomName,
      });
      setPhase('active');
    } catch (err) {
      const message = errorMessage(err);
      toast.error(message);
      setPhase('idle');
      dispatch(resetRecording());
    }
  };

  const handleEnd = () => {
    // The end-of-session pipeline runs on the agent worker AFTER disconnect:
    //   1. agent flushes captured audio → voice-service /analyze
    //   2. voice-service returns transcript + biomarkers
    //   3. agent POSTs result → backend /api/v1/checkins/from-session
    //
    // Rather than blind-waiting a fixed time, we poll the trajectory endpoint
    // for the new point. The user sees a real countdown + step list and gets
    // routed the moment the check-in actually lands.
    if (finalisedRef.current) return;
    finalisedRef.current = true;
    setPhase('finalising');
    setFinalisationCompleted(false);
    dispatch(setRecordingStatus('analysing'));
    setCreds(null); // tearing down LiveKitRoom triggers disconnect

    const startedAt = performance.now();
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const baselineTotal = baselineTotalRef.current ?? 0;

    const finish = (landed: boolean) => {
      if (stopped) return;
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      // The agent worker posted directly to the backend (bypassing RTK Query),
      // so RTK Query has no idea fresh data exists. Force-invalidate the
      // dashboard tags so /trajectory refetches on mount.
      dispatch(
        enhancedApi.util.invalidateTags([
          'Trajectory',
          'Baseline',
          'TriageEvents',
          'Checkin',
        ]),
      );
      dispatch(setRecordingStatus('done'));
      setFinalisationCompleted(true);

      if (landed) {
        toast.success('Check-in saved. Trajectory updated.');
      } else {
        toast.message('Still processing your voice biomarkers in the background.', {
          description: 'Your trajectory will refresh when the agent finishes.',
        });
      }

      // Tiny pause so the user sees the ring snap to "complete" before we
      // navigate away.
      setTimeout(() => router.push('/trajectory'), 600);
    };

    const pollOnce = async () => {
      if (stopped) return;
      try {
        const snapshot = await pollTrajectory().unwrap();
        if ((snapshot.total ?? 0) > baselineTotal) {
          finish(true);
          return;
        }
      } catch {
        // Swallow — a transient poll error shouldn't break the flow; we'll
        // try again on the next tick or hit the hard timeout.
      }
      if (stopped) return;
      const elapsed = performance.now() - startedAt;
      if (elapsed >= FINALISATION_HARD_TIMEOUT_MS) {
        finish(false);
        return;
      }
      pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
    };

    timeoutTimer = setTimeout(() => finish(false), FINALISATION_HARD_TIMEOUT_MS);
    // Start the first poll after one tick so the agent has a beat to wake up.
    pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
  };

  const handleRoomDisconnect = () => {
    if (phase === 'active') {
      // The room dropped on us (network blip, agent error, etc) — treat as ended.
      handleEnd();
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem-3rem)] w-full max-w-2xl flex-col px-6 py-10">
      <div className="mb-8 flex items-center justify-between text-sm text-muted-foreground">
        <Link
          href="/trajectory"
          className="cursor-pointer inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Trajectory
        </Link>
        <span>{format(today, 'EEEE d MMMM, yyyy')}</span>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Today&apos;s prompt for {user?.displayName ?? 'you'}
      </p>

      <h1 className="mt-3 font-serif text-balance text-3xl leading-snug text-foreground sm:text-4xl">
        {prompt}
      </h1>

      <Card className="mt-10 border-border/70 bg-card/70 shadow-sm">
        <CardContent className="px-6 py-10 sm:px-10">
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="grid h-32 w-32 place-items-center rounded-full border border-border/60 bg-card shadow-sm">
                  <Sparkles className="h-9 w-9 text-primary" strokeWidth={1.5} />
                </div>
                <div className="max-w-md text-center">
                  <p className="font-serif text-lg leading-relaxed text-foreground/90">
                    Olando will greet you, listen, and reflect.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Three minutes, no scoring. End the call whenever you&apos;re ready.
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="cursor-pointer"
                  onClick={startCheckIn}
                  disabled={isIssuing}
                >
                  {isIssuing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-4 w-4" />
                      Start check-in
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {phase === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-10 text-muted-foreground"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Joining the room…</p>
              </motion.div>
            )}

            {phase === 'active' && creds && (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <LiveKitRoom
                  token={creds.token}
                  serverUrl={creds.url}
                  audio
                  video={false}
                  connect
                  onDisconnected={handleRoomDisconnect}
                  onError={(err) => {
                    toast.error(`LiveKit error: ${err.message}`);
                  }}
                  className="!bg-transparent"
                  data-lk-theme="default"
                >
                  <ConversationRoom onEnd={handleEnd} />
                </LiveKitRoom>
              </motion.div>
            )}

            {phase === 'finalising' && (
              <motion.div
                key="finalising"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <FinalisingProgress
                  totalMs={FINALISATION_BUDGET_MS}
                  completed={finalisationCompleted}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Audio is processed by the Speechmatics medical transcript model and the
        thymia Sentinel biomarker model. Nothing leaves your private backend
        unless you explicitly download a triage packet.
      </p>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { message?: string } }).data;
    if (data?.message) return data.message;
  }
  if (err && typeof err === 'object' && 'status' in err) {
    return 'The backend could not start a session. Check that LIVEKIT_URL/KEY/SECRET are set in backend/.env.';
  }
  if (err instanceof Error) return err.message;
  return 'Could not start the check-in.';
}
