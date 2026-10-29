// $aura and $gold ledger: every change to a balance is one ledger row plus one balance update, in the caller's
// transaction. Ledger rows carry their currency; $aura is in milli-$aura, $gold in whole $gold.

import { and, eq, gte, sql } from 'drizzle-orm';
import type { Conn } from './db';
import { accounts, ledger } from './db/schema';
import { notEnoughAura, notEnoughGold } from './errors';
import { fromUnits, STARTER_AURA, toUnits } from './rules/aura';

/** Create the account on first sight, with its starter $aura. Fills before `now` never count toward rewards. */
export async function ensureAccount(tx: Conn, address: string, now: number) {
  const created = await tx.insert(accounts).values({ address, fillsSyncedUntil: now, createdAt: new Date(now) }).onConflictDoNothing().returning({ address: accounts.address });
  if (created.length) await credit(tx, address, toUnits(STARTER_AURA), 'starter', 'starter');
}

/** Add `units` to a balance. With a `ref`, the same (kind, ref) is only ever credited once; returns false if it was. */
export async function credit(tx: Conn, address: string, units: number, kind: string, ref?: string): Promise<boolean> {
  if (units <= 0) return false;
  const row = await tx.insert(ledger).values({ address, delta: units, kind, ref: ref ?? null }).onConflictDoNothing().returning({ id: ledger.id });
  if (!row.length) return false;
  await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${units}` }).where(eq(accounts.address, address));
  return true;
}

/** Take `units` from a balance, or throw not_enough_aura. */
export async function debit(tx: Conn, address: string, units: number, kind: string, ref?: string) {
  if (units <= 0) return;
  const done = await tx
    .update(accounts)
    .set({ balance: sql`${accounts.balance} - ${units}` })
    .where(and(eq(accounts.address, address), gte(accounts.balance, units)))
    .returning({ balance: accounts.balance });
  if (!done.length) throw notEnoughAura(fromUnits(units));
  await tx.insert(ledger).values({ address, delta: -units, kind, ref: ref ?? null });
}

export async function balanceOf(tx: Conn, address: string): Promise<number> {
  const [a] = await tx.select({ balance: accounts.balance }).from(accounts).where(eq(accounts.address, address));
  return a?.balance ?? 0;
}

/** Add whole `gold` to a balance. With a `ref`, the same (kind, ref) is only ever credited once; returns false if it was. */
export async function creditGold(tx: Conn, address: string, gold: number, kind: string, ref?: string): Promise<boolean> {
  if (gold <= 0) return false;
  const row = await tx.insert(ledger).values({ address, delta: gold, currency: 'gold', kind, ref: ref ?? null }).onConflictDoNothing().returning({ id: ledger.id });
  if (!row.length) return false;
  await tx.update(accounts).set({ gold: sql`${accounts.gold} + ${gold}` }).where(eq(accounts.address, address));
  return true;
}

/** Take whole `gold` from a balance, or throw not_enough_gold. */
export async function debitGold(tx: Conn, address: string, gold: number, kind: string, ref?: string) {
  if (gold <= 0) return;
  const done = await tx
    .update(accounts)
    .set({ gold: sql`${accounts.gold} - ${gold}` })
    .where(and(eq(accounts.address, address), gte(accounts.gold, gold)))
    .returning({ gold: accounts.gold });
  if (!done.length) throw notEnoughGold(gold);
  await tx.insert(ledger).values({ address, delta: -gold, currency: 'gold', kind, ref: ref ?? null });
}

export async function goldOf(tx: Conn, address: string): Promise<number> {
  const [a] = await tx.select({ gold: accounts.gold }).from(accounts).where(eq(accounts.address, address));
  return a?.gold ?? 0;
}
