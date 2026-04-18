'use client';

import { useEffect, useRef } from 'react';

interface WaveformProps {
  /** AnalyserNode levels (0-255). When null, the waveform draws a flat resting line. */
  analyser: AnalyserNode | null;
  active: boolean;
}

/**
 * Lightweight live waveform — reads from the Web Audio AnalyserNode that the
 * recording hook hands us, draws a centred bar visualisation that breathes with
 * the user's voice. Resting state shows a quiet flat line so the box never
 * looks broken when nothing is happening.
 */
export function Waveform({ analyser, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const barCount = 56;
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const primary = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();
      const muted = getComputedStyle(document.documentElement)
        .getPropertyValue('--muted-foreground')
        .trim();
      const colour = active && analyser ? `oklch(${primary})` : `oklch(${muted} / 0.35)`;

      ctx.fillStyle = colour;

      const barWidth = (w / barCount) * 0.55;
      const gap = w / barCount;

      let levels: number[] = [];
      if (active && analyser) {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / barCount);
        levels = Array.from({ length: barCount }, (_, i) => {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
          return sum / Math.max(step, 1) / 255;
        });
      } else {
        phase += 0.04;
        levels = Array.from({ length: barCount }, (_, i) => {
          return 0.04 + 0.015 * Math.sin(phase + i * 0.4);
        });
      }

      levels.forEach((level, i) => {
        const minH = h * 0.06;
        const barH = Math.max(minH, level * h * 0.95);
        const x = i * gap + (gap - barWidth) / 2;
        const y = (h - barH) / 2;
        const r = Math.min(barWidth / 2, 4);
        // rounded rect
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + barWidth, y, x + barWidth, y + barH, r);
        ctx.arcTo(x + barWidth, y + barH, x, y + barH, r);
        ctx.arcTo(x, y + barH, x, y, r);
        ctx.arcTo(x, y, x + barWidth, y, r);
        ctx.closePath();
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full rounded-xl border border-border/60 bg-card/60"
      aria-hidden
    />
  );
}
