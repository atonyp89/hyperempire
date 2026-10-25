// Townhall state. Saved in this browser (per wallet) until the Townhall contract ships.

import { useCallback, useEffect, useState } from 'react';
import { NETWORK } from '../config';
import { readMigrating } from '../lib/storage';
import {
  branchSpent,
  levelCost,
  perkPoints,
  PERKS,
  respecCost,
  STARTER_AURA,
  TIER_POINTS,
  totalSpent,
} from '../lib/empire';

type Saved = { level: number; auraSpent: number; ranks: Record<string, number>; respecs: number };
const FRESH: Saved = { level: 1, auraSpent: 0, ranks: {}, respecs: 0 };

const who = (user?: string) => `${NETWORK}.${(user ?? 'guest').toLowerCase()}`;
const keyFor = (user?: string) => `hyperempire.townhall.${who(user)}`;
const oldKeyFor = (user?: string) => `degen-empire.townhall.${who(user)}`;

function load(user?: string): Saved {
  try {
    const raw = readMigrating(keyFor(user), [oldKeyFor(user)]);
    return raw ? { ...FRESH, ...(JSON.parse(raw) as Saved) } : FRESH;
  } catch {
    return FRESH;
  }
}

export type UpgradeResult = { ok: boolean; level: number; spent: number; chance: number };

export function useTownhall(user: `0x${string}` | undefined, auraEarned: number) {
  const [state, setState] = useState<Saved>(() => load(user));
  useEffect(() => setState(load(user)), [user]);

  const save = useCallback(
    (next: Saved) => {
      setState(next);
      try {
        localStorage.setItem(keyFor(user), JSON.stringify(next));
      } catch {
        // Storage blocked: progress lasts for this visit only.
      }
    },
    [user],
  );

  const balance = Math.max(0, Math.floor(STARTER_AURA + auraEarned - state.auraSpent));
  const nextCost = levelCost(state.level);
  const points = perkPoints(state.level) - totalSpent(state.ranks);
  const respec = respecCost(state.level, state.respecs);

  /** Pay `chance`% of the next level's cost for a `chance`% shot at levelling up. The $aura burns either way. */
  function upgrade(chance: number): UpgradeResult | null {
    const spent = Math.round((nextCost * chance) / 100);
    if (spent > balance) return null;
    const ok = chance >= 100 || Math.random() < chance / 100;
    const level = ok ? state.level + 1 : state.level;
    save({ ...state, level, auraSpent: state.auraSpent + spent });
    return { ok, level, spent, chance };
  }

  function canRank(perkId: string): boolean {
    const p = PERKS.find((x) => x.id === perkId);
    if (!p || points < 1) return false;
    if ((state.ranks[p.id] ?? 0) >= p.maxRank) return false;
    return branchSpent(state.ranks, p.branch) >= TIER_POINTS[p.tier];
  }

  function addRank(perkId: string) {
    if (!canRank(perkId)) return;
    save({ ...state, ranks: { ...state.ranks, [perkId]: (state.ranks[perkId] ?? 0) + 1 } });
  }

  function doRespec(): boolean {
    if (totalSpent(state.ranks) === 0 || respec > balance) return false;
    save({ ...state, ranks: {}, respecs: state.respecs + 1, auraSpent: state.auraSpent + respec });
    return true;
  }

  return { ...state, balance, nextCost, points, respec, upgrade, canRank, addRank, doRespec };
}
