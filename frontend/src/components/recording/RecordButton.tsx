'use client';

import { motion } from 'framer-motion';
import { Loader2, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'idle' | 'recording' | 'analysing';

interface RecordButtonProps {
  mode: Mode;
  onClick: () => void;
  disabled?: boolean;
}

export function RecordButton({ mode, onClick, disabled }: RecordButtonProps) {
  const recording = mode === 'recording';
  const analysing = mode === 'analysing';

  return (
    <div className="relative grid place-items-center">
      {/* Pulsing aura — only while recording */}
      {recording && (
        <>
          <motion.span
            aria-hidden
            className="absolute h-44 w-44 rounded-full bg-status-divergence/15"
            animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            aria-hidden
            className="absolute h-44 w-44 rounded-full bg-status-divergence/20"
            animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0.1, 0.7] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.4,
            }}
          />
        </>
      )}

      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled || analysing}
        whileTap={{ scale: disabled || analysing ? 1 : 0.96 }}
        className={cn(
          'relative grid h-32 w-32 place-items-center rounded-full text-primary-foreground shadow-lg ring-1 ring-black/[0.04] transition-colors duration-200',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-80',
          recording && 'bg-status-divergence shadow-status-divergence/30 hover:bg-status-divergence/95',
          analysing && 'bg-primary',
          !recording && !analysing && 'bg-primary hover:bg-primary/90',
        )}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        {analysing ? (
          <Loader2 className="h-9 w-9 animate-spin" strokeWidth={2.25} />
        ) : recording ? (
          <Square className="h-8 w-8 fill-current" strokeWidth={0} />
        ) : (
          <Mic className="h-9 w-9" strokeWidth={2.25} />
        )}
      </motion.button>
    </div>
  );
}
