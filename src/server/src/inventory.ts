// Inventory: items a player holds, by id, with a count. Every change runs in the caller's transaction.

import { and, eq, gte, sql } from 'drizzle-orm';
import type { Conn } from './db';
import { inventory } from './db/schema';
import { conflict } from './errors';

/** Add `qty` of an item. */
export async function addItem(tx: Conn, address: string, item: string, qty: number) {
  if (qty <= 0) return;
  await tx
    .insert(inventory)
    .values({ address, item, qty })
    .onConflictDoUpdate({ target: [inventory.address, inventory.item], set: { qty: sql`${inventory.qty} + ${qty}` } });
}

/** Take `qty` of an item, or throw 409 `not_enough_items` (with `what` in the message) if there are fewer. */
export async function takeItem(tx: Conn, address: string, item: string, qty: number, what: string) {
  if (qty <= 0) return;
  const done = await tx
    .update(inventory)
    .set({ qty: sql`${inventory.qty} - ${qty}` })
    .where(and(eq(inventory.address, address), eq(inventory.item, item), gte(inventory.qty, qty)))
    .returning({ qty: inventory.qty });
  if (!done.length) throw conflict(`Not enough ${what}: this needs ${qty}.`, 'not_enough_items');
}

/** Everything held, by item id; items at 0 are left out. */
export async function itemsOf(tx: Conn, address: string): Promise<Record<string, number>> {
  const rows = await tx.select().from(inventory).where(eq(inventory.address, address));
  return Object.fromEntries(rows.filter((r) => r.qty > 0).map((r) => [r.item, r.qty]));
}
