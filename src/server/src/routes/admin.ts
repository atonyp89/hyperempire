// Read-only admin dashboard API: tables, their schema and rows, and SQL queries run in a READ ONLY transaction.
// Protected by HTTP Basic auth with the username and password in deps.admin; without them /admin doesn't exist.

import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AdminOverview, AdminQueryResult, AdminRows, AdminTable } from '../contract';
import type { Conn } from '../db';
import { rows } from '../db/migrations';
import { ADMIN_MIN_PASSWORD } from '../deps';
import type { Env } from '../env';
import { ApiError, badRequest, notFound } from '../errors';
import { fromUnits } from '../rules/aura';

/** Most rows one query or one page returns. */
const MAX_ROWS = 500;
/** Failed logins allowed per client in a window before it has to wait. */
const MAX_FAILS = 10;
const FAIL_WINDOW_MS = 15 * 60_000;
const fails = new Map<string, { count: number; since: number }>();

const enc = new TextEncoder();
/** Compare two strings in time that doesn't depend on where they differ. */
function same(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const creds = c.var.deps.admin;
  if (!creds || creds.password.length < ADMIN_MIN_PASSWORD) throw notFound('Admin dashboard');
  const client = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = c.var.deps.now();
  const f = fails.get(client);
  if (f && now - f.since > FAIL_WINDOW_MS) fails.delete(client);
  if ((fails.get(client)?.count ?? 0) >= MAX_FAILS) throw new ApiError(429, 'too_many_attempts', 'Too many failed logins. Try again in 15 minutes.');

  const h = c.req.header('authorization') ?? '';
  let user = '';
  let password = '';
  if (h.startsWith('Basic ')) {
    try {
      const decoded = atob(h.slice(6));
      const i = decoded.indexOf(':');
      if (i >= 0) [user, password] = [decoded.slice(0, i), decoded.slice(i + 1)];
    } catch {
      // Not base64: treated as no credentials.
    }
  }
  // Check both, always, so a wrong username takes as long as a wrong password.
  const ok = same(user, creds.user) && same(password, creds.password);
  if (!ok) {
    const cur = fails.get(client) ?? { count: 0, since: now };
    fails.set(client, { count: cur.count + 1, since: cur.since });
    throw new ApiError(401, 'admin_unauthorized', 'Wrong username or password.');
  }
  fails.delete(client);
  await next();
});

/** JSON-safe values: big integers become strings unless they fit a number, dates become ISO strings. */
function clean(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') out[k] = Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (v instanceof Uint8Array) out[k] = `\\x${Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    else out[k] = v;
  }
  return out;
}

/** Column names of a raw result, even when it has no rows (PGlite: fields, postgres-js: columns). */
function columnsOf(result: unknown, list: Record<string, unknown>[]): string[] {
  const r = result as { fields?: { name: string }[]; columns?: { name: string }[] };
  return r.fields?.map((f) => f.name) ?? r.columns?.map((c) => c.name) ?? Object.keys(list[0] ?? {});
}

async function tables(db: Conn): Promise<AdminTable[]> {
  const cols = rows<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
    await db.execute(sql`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`),
  );
  const idx = rows<{ tablename: string; indexdef: string }>(await db.execute(sql`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`));
  const names = [...new Set(cols.map((c) => c.table_name))];
  const out: AdminTable[] = [];
  for (const name of names) {
    const [{ n }] = rows<{ n: number | string }>(await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(name)}`));
    out.push({
      name,
      rows: Number(n),
      columns: cols
        .filter((c) => c.table_name === name)
        .map((c) => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable === 'YES', default: c.column_default })),
      indexes: idx.filter((i) => i.tablename === name).map((i) => i.indexdef),
    });
  }
  return out;
}

export const admin = new Hono<Env>()
  .use(requireAdmin)
  .get('/overview', async (c) => {
    const { db, network } = c.var.deps;
    const [supply] = rows<{ s: number | string | null }>(await db.execute(sql`SELECT coalesce(sum(balance), 0)::bigint AS s FROM accounts`));
    const byKind = rows<{ kind: string; total: number | string; entries: number | string }>(
      await db.execute(sql`SELECT kind, sum(delta)::bigint AS total, count(*)::int AS entries FROM ledger GROUP BY kind ORDER BY sum(delta) DESC`),
    );
    const chain = rows<{ settled_height: number | string }>(await db.execute(sql`SELECT settled_height FROM chain WHERE id = 1`));
    const body: AdminOverview = {
      network,
      tables: await tables(db),
      auraSupply: fromUnits(Number(supply?.s ?? 0)),
      ledgerByKind: byKind.map((k) => ({ kind: k.kind, total: fromUnits(Number(k.total)), entries: Number(k.entries) })),
      settledHeight: chain[0] ? Number(chain[0].settled_height) : null,
    };
    return c.json(body);
  })
  .get('/tables/:name', async (c) => {
    const { db } = c.var.deps;
    const name = c.req.param('name');
    const table = (await tables(db)).find((t) => t.name === name);
    if (!table) throw notFound('Table');
    const limit = Math.min(MAX_ROWS, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0) || 0);
    const orderCol = table.columns.find((col) => col.name === c.req.query('order'))?.name ?? table.columns[0]?.name;
    const dir = c.req.query('dir') === 'asc' ? sql`ASC` : sql`DESC`;
    const order = orderCol ? sql`ORDER BY ${sql.identifier(orderCol)} ${dir} NULLS LAST` : sql``;
    const list = rows<Record<string, unknown>>(
      await db.execute(sql`SELECT * FROM ${sql.identifier(name)} ${order} LIMIT ${limit} OFFSET ${offset}`),
    ).map(clean);
    const body: AdminRows = { table: name, columns: table.columns.map((col) => col.name), rows: list, total: table.rows, limit, offset };
    return c.json(body);
  })
  .post('/query', async (c) => {
    const { db, now } = c.var.deps;
    const text = String((await c.req.json().catch(() => ({}))).sql ?? '').trim().replace(/;\s*$/, '');
    if (!text) throw badRequest('Write a query first.');
    if (!READS.test(text)) throw badRequest('Only reads are allowed: SELECT, WITH, EXPLAIN, SHOW, TABLE or VALUES.', 'query_failed');
    const started = now();
    let result: unknown;
    try {
      // READ ONLY makes Postgres refuse any write; the transaction is rolled back either way.
      await db
        .transaction(async (tx) => {
          await tx.execute(sql`SET TRANSACTION READ ONLY`);
          // A first query locks the mode in: after it, SET TRANSACTION READ WRITE is an error.
          await tx.execute(sql`SELECT 1`);
          result = await tx.execute(sql.raw(text));
          throw ROLLBACK;
        })
        .catch((err) => {
          if (err !== ROLLBACK) throw err;
        });
    } catch (err) {
      const cause = (err as { cause?: { message?: string } }).cause?.message;
      throw badRequest(cause ?? (err instanceof Error ? err.message : 'The query failed.'), 'query_failed');
    }
    const all = rows<Record<string, unknown>>(result);
    const body: AdminQueryResult = {
      columns: columnsOf(result, all),
      rows: all.slice(0, MAX_ROWS).map(clean),
      rowCount: all.length,
      truncated: all.length > MAX_ROWS,
      ms: now() - started,
    };
    return c.json(body);
  });

const ROLLBACK = Symbol('rollback');
/** Statements the query box accepts (after leading comments). The read-only transaction is the real guard. */
const READS = /^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*(select|with|explain|show|table|values)\b/i;
