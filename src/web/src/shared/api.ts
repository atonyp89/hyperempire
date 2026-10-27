// The one door to the HyperEmpire API. Every call goes through `api()`, which either runs the server in this
// browser (VITE_API_URL=local, the default while developing) or calls a deployed server at VITE_API_URL.
// Requests and responses are real `Request`/`Response` objects either way, so switching needs no other change.

import type { ApiErrorBody } from '@server/contract';
import { NETWORK } from './network';

const API_URL = (import.meta.env.VITE_API_URL ?? 'local').trim() || 'local';
export const API_MODE: 'local' | 'remote' = API_URL === 'local' ? 'local' : 'remote';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  if (API_URL === 'local') {
    // Loaded on first use, so a production build pointed at a real server never fetches it.
    const { localServer } = await import('@server/local');
    const server = await localServer(NETWORK, { admin: __LOCAL_ADMIN__ ?? undefined });
    return server.fetch(new Request(`http://local.hyperempire${path}`, init));
  }
  return fetch(`${API_URL.replace(/\/$/, '')}${path}`, init);
}

export type ApiOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Session token, sent as Bearer. */
  token?: string | null;
  /** A whole Authorization header instead (the admin dashboard's Basic login). */
  authorization?: string;
};

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.authorization) headers.authorization = opts.authorization;
  let res: Response;
  try {
    res = await send(path, { method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'), headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch (err) {
    throw new ApiRequestError(0, 'unreachable', err instanceof Error ? err.message : 'The server could not be reached.');
  }
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const e = data as ApiErrorBody | null;
    throw new ApiRequestError(res.status, e?.error ?? 'error', e?.message ?? `Request failed (${res.status}).`);
  }
  return data as T;
}
