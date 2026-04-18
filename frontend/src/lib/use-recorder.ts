'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseRecorderResult {
  isRecording: boolean;
  durationSec: number;
  analyser: AnalyserNode | null;
  /** Start microphone capture. Resolves once we are actually recording. */
  start: () => Promise<void>;
  /** Stop and return the captured audio Blob plus its detected mime type. */
  stop: () => Promise<{ blob: Blob; mimeType: string; durationSec: number }>;
  /** Throw away any in-progress capture and release the mic. */
  reset: () => void;
  error: string | null;
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * Microphone capture with a Web Audio AnalyserNode tap so the waveform stays in
 * sync with the recorder's lifecycle. Stop returns a Promise resolving to the
 * full Blob so the caller can await it before kicking off the upload mutation.
 */
export function useRecorder(maxSeconds: number): UseRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const stopResolveRef = useRef<
    ((value: { blob: Blob; mimeType: string; durationSec: number }) => void) | null
  >(null);

  const cleanupStreams = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setAnalyser(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Microphone is not supported in this browser.');
      throw new Error('No mic support');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        const elapsed = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        cleanupStreams();
        setIsRecording(false);
        if (stopResolveRef.current) {
          stopResolveRef.current({
            blob,
            mimeType: finalMime,
            durationSec: elapsed,
          });
          stopResolveRef.current = null;
        }
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      source.connect(node);
      setAnalyser(node);

      startedAtRef.current = Date.now();
      setDurationSec(0);
      recorder.start(250);
      setIsRecording(true);

      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDurationSec(elapsed);
        if (elapsed >= maxSeconds && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 200);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not access microphone';
      setError(msg);
      cleanupStreams();
      throw err;
    }
  }, [cleanupStreams, maxSeconds]);

  const stop = useCallback((): Promise<{
    blob: Blob;
    mimeType: string;
    durationSec: number;
  }> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        resolve({ blob: new Blob(), mimeType: 'audio/webm', durationSec: 0 });
        return;
      }
      stopResolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  const reset = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    chunksRef.current = [];
    cleanupStreams();
    setDurationSec(0);
    setIsRecording(false);
    stopResolveRef.current = null;
  }, [cleanupStreams]);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  return { isRecording, durationSec, analyser, start, stop, reset, error };
}
