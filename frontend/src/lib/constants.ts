export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Olando';
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:3001';

/** Daily reflective prompt rotated by date so the recording screen never feels static. */
export const DAILY_PROMPTS = [
  'How are you doing today, in your own words?',
  'What feels heaviest right now, and what feels lighter?',
  "Describe today's energy. What helped, what didn't?",
  'How did you sleep, and how does that show up today?',
  "What's been on your mind that you haven't said out loud yet?",
  'How does your body feel as you sit here?',
  "If today had a colour, what would it be — and why?",
];

export function getPromptForDate(date: Date = new Date()): string {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length] ?? DAILY_PROMPTS[0];
}

export const RECORDING_MAX_SECONDS = 60;
export const RECORDING_MIN_SECONDS = 3;
