'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarVisualizer,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useVoiceAssistant,
  useTranscriptions,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConversationRoomProps {
  /** Called when the user explicitly ends the check-in (the room then disconnects). */
  onEnd: () => void;
}

const STATE_LABEL: Record<string, { label: string; tone: string; dot: string }> = {
  initializing: {
    label: 'Connecting',
    tone: 'text-muted-foreground',
    dot: 'bg-muted-foreground/40',
  },
  listening: {
    label: 'Listening',
    tone: 'text-status-stable',
    dot: 'bg-status-stable',
  },
  thinking: {
    label: 'Thinking',
    tone: 'text-primary',
    dot: 'bg-primary animate-pulse',
  },
  speaking: {
    label: 'Speaking',
    tone: 'text-primary',
    dot: 'bg-primary',
  },
  disconnected: {
    label: 'Reconnecting',
    tone: 'text-status-trending',
    dot: 'bg-status-trending animate-pulse',
  },
};

export function ConversationRoom({ onEnd }: ConversationRoomProps) {
  const connectionState = useConnectionState();
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Sync mute toggle with the local participant's microphone track.
  useEffect(() => {
    if (!localParticipant) return;
    void localParticipant.setMicrophoneEnabled(!isMuted);
  }, [isMuted, localParticipant]);

  // Auto-scroll transcript to bottom when new messages arrive.
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptions.length]);

  const visibleState = useMemo(() => {
    if (connectionState === ConnectionState.Disconnected) return 'disconnected';
    if (connectionState !== ConnectionState.Connected) return 'initializing';
    return agentState ?? 'initializing';
  }, [connectionState, agentState]);

  const stateMeta = STATE_LABEL[visibleState] ?? STATE_LABEL.initializing;

  return (
    <div className="flex w-full flex-col gap-8">
      {/* invisible — but absolutely required: actually plays the agent's voice */}
      <RoomAudioRenderer />

      {/* Agent presence orb */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative grid h-44 w-44 place-items-center">
          <div
            aria-hidden
            className={`absolute inset-0 rounded-full bg-primary/10 blur-2xl transition-opacity duration-500 ${
              visibleState === 'speaking'
                ? 'opacity-100'
                : visibleState === 'thinking'
                  ? 'opacity-70'
                  : visibleState === 'listening'
                    ? 'opacity-40'
                    : 'opacity-20'
            }`}
          />
          <div className="relative grid h-32 w-32 place-items-center rounded-full border border-border/60 bg-card shadow-sm">
            {audioTrack ? (
              <BarVisualizer
                state={agentState}
                trackRef={audioTrack}
                barCount={5}
                options={{ minHeight: 8, maxHeight: 60 }}
                className="h-16 w-20 [&>span]:bg-primary [&>span]:rounded-full"
              />
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${stateMeta.dot}`} />
          <span className={stateMeta.tone}>{stateMeta.label}</span>
        </div>
      </div>

      {/* Live transcript */}
      <div className="rounded-xl border border-border/70 bg-card/50">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Live transcript
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {transcriptions.length} message{transcriptions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div
          ref={transcriptRef}
          className="max-h-64 min-h-32 overflow-y-auto px-5 py-4"
        >
          <AnimatePresence initial={false}>
            {transcriptions.length === 0 && (
              <motion.p
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm italic text-muted-foreground/70"
              >
                Waiting for the conversation to begin…
              </motion.p>
            )}
            {transcriptions.map((entry) => {
              const identity = entry.participantInfo?.identity ?? '';
              // The agent worker registers participant identities prefixed with
              // `agent-` (LiveKit Agents convention). The user gets `user-...`
              // from our backend's session token.
              const isAgent = identity.startsWith('agent');
              return (
                <motion.div
                  key={entry.streamInfo.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mb-3 last:mb-0"
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                    {isAgent ? 'Second Voice' : 'You'}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                    {entry.text}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setIsMuted((m) => !m)}
          className="cursor-pointer"
        >
          {isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={onEnd}
          className="cursor-pointer"
        >
          <PhoneOff className="mr-2 h-4 w-4" />
          End check-in
        </Button>
      </div>
    </div>
  );
}
