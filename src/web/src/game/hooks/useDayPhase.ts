// Time of day for the Empire scene, from the player's local clock, with a manual override for demos.

import { useEffect, useState } from 'react';

export type Phase = 'morning' | 'evening' | 'night';
export type PhaseMode = 'auto' | Phase;

const MODES: PhaseMode[] = ['auto', 'morning', 'evening', 'night'];
const KEY = 'hyperempire.timeOfDay';

/** Morning 05:00–11:59, evening 12:00–18:59, night 19:00–04:59. */
export function phaseAt(date: Date): Phase {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'evening';
  return 'night';
}

function savedMode(): PhaseMode {
  try {
    const v = localStorage.getItem(KEY) as PhaseMode | null;
    return v && MODES.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function useDayPhase() {
  const [mode, setMode] = useState<PhaseMode>(savedMode);
  const [now, setNow] = useState(() => new Date());

  // Re-check the clock every minute so the scene changes on its own at 05:00, 12:00 and 19:00.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const cycle = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the override lasts for this visit.
    }
  };

  const phase: Phase = mode === 'auto' ? phaseAt(now) : mode;
  return { phase, mode, now, cycle };
}
