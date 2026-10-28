// Wallet sign-in: the client asks for a nonce, the wallet signs a message containing it, and a valid signature
// returns a session token (Bearer) for the API. Works the same in the browser and on a server.

import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { isAddress, verifyMessage } from 'viem';
import { nonces, sessions } from '../db/schema';
import { randomHex } from '../deps';
import type { Env } from '../env';
import { badRequest, unauthorized } from '../errors';
import { creditRewards } from '../exchange';
import { ensureAccount } from '../ledger';

const NONCE_MS = 10 * 60_000;
const SESSION_MS = 30 * 24 * 60 * 60_000;

/** The exact text the wallet signs. */
export const signInMessage = (address: string, network: string, nonce: string) =>
  `HyperEmpire wants you to sign in with your wallet.\n\nAddress: ${address}\nNetwork: ${network}\nNonce: ${nonce}`;

function readAddress(v: unknown): `0x${string}` {
  if (typeof v !== 'string' || !isAddress(v)) throw badRequest('A wallet address is required.');
  return v.toLowerCase() as `0x${string}`;
}

export const auth = new Hono<Env>()
  .post('/nonce', async (c) => {
    const { db, network, now } = c.var.deps;
    const address = readAddress((await c.req.json().catch(() => ({}))).address);
    const nonce = randomHex(16);
    await db.insert(nonces).values({ nonce, address, expiresAt: now() + NONCE_MS });
    return c.json({ nonce, message: signInMessage(address, network, nonce) });
  })
  .post('/verify', async (c) => {
    const { db, network, now } = c.var.deps;
    const body = await c.req.json().catch(() => ({}));
    const address = readAddress(body.address);
    const nonce = typeof body.nonce === 'string' ? body.nonce : '';
    const signature = typeof body.signature === 'string' && body.signature.startsWith('0x') ? (body.signature as `0x${string}`) : null;
    if (!signature) throw badRequest('A signature is required.');
    const [found] = await db.delete(nonces).where(and(eq(nonces.nonce, nonce), eq(nonces.address, address), gt(nonces.expiresAt, now()))).returning();
    if (!found) throw unauthorized('That sign-in request expired. Try again.');
    const ok = await verifyMessage({ address, message: signInMessage(address, network, nonce), signature }).catch(() => false);
    if (!ok) throw unauthorized('The signature does not match this wallet.');
    const token = randomHex(32);
    const expiresAt = now() + SESSION_MS;
    await db.transaction(async (tx) => {
      await ensureAccount(tx, address, now());
      // Shares of days settled before this wallet signed up (mainnet files list every fill through our builder).
      await creditRewards(tx, address);
      await tx.insert(sessions).values({ token, address, expiresAt });
    });
    return c.json({ token, address, expiresAt });
  })
  .post('/sign-out', async (c) => {
    const token = bearer(c.req.header('authorization'));
    if (token) await c.var.deps.db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ ok: true });
  });

const bearer = (h: string | undefined) => (h?.startsWith('Bearer ') ? h.slice(7) : null);

/** Requires a valid session; sets c.var.address to the signed-in wallet. */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const token = bearer(c.req.header('authorization'));
  if (!token) throw unauthorized();
  const { db, now } = c.var.deps;
  const [s] = await db.select().from(sessions).where(and(eq(sessions.token, token), gt(sessions.expiresAt, now())));
  if (!s) throw unauthorized('Your session expired. Sign in again.');
  c.set('address', s.address);
  await next();
});
