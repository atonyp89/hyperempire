// The HyperEmpire API as one Hono app. It only talks to the outside through Deps, so the same app is served by
// Bun in production (main.ts) and called in-process in the browser during development (local.ts).

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiErrorBody } from './contract';
import type { Deps } from './deps';
import type { Env } from './env';
import { ApiError } from './errors';
import { admin } from './routes/admin';
import { auth, requireAuth } from './routes/auth';
import { exchange } from './routes/exchange';
import { gold } from './routes/gold';
import { mastery } from './routes/mastery';
import { me } from './routes/me';
import { mining } from './routes/mining';
import { townhall } from './routes/townhall';

export function createApp(deps: Deps) {
  const app = new Hono<Env>();
  if (deps.allowedOrigins?.length) app.use(cors({ origin: deps.allowedOrigins, allowHeaders: ['Authorization', 'Content-Type'] }));
  app.use(async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json<ApiErrorBody>({ error: err.code, message: err.message }, err.status);
    console.error('[api]', err);
    return c.json<ApiErrorBody>({ error: 'internal', message: 'Something went wrong on the server.' }, 500);
  });
  app.notFound((c) => c.json<ApiErrorBody>({ error: 'not_found', message: 'No such endpoint.' }, 404));

  app.get('/health', (c) => c.json({ ok: true, network: deps.network }));
  app.route('/auth', auth);
  app.use('/me/*', requireAuth);
  app.use('/townhall/*', requireAuth);
  app.use('/mine/*', requireAuth);
  app.use('/exchange/*', requireAuth);
  app.use('/mastery/*', requireAuth);
  app.use('/gold/*', requireAuth);
  app.route('/me', me);
  app.route('/townhall', townhall);
  app.route('/mine', mining);
  app.route('/exchange', exchange);
  app.route('/mastery', mastery);
  app.route('/gold', gold);
  app.route('/admin', admin);
  return app;
}

export type App = ReturnType<typeof createApp>;
