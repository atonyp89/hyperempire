// API errors: a status, a stable machine-readable code, and a readable message. Every route throws these;
// app.ts turns them into JSON responses ({ error, message }).

import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'bad_request') => new ApiError(400, code, message);
export const unauthorized = (message = 'Sign in first.') => new ApiError(401, 'unauthorized', message);
export const notEnoughAura = (needed: number) => new ApiError(402, 'not_enough_aura', `Not enough $aura: this needs ${needed.toLocaleString('en-US')}.`);
export const notFound = (what: string) => new ApiError(404, 'not_found', `${what} not found.`);
export const conflict = (message: string, code = 'conflict') => new ApiError(409, code, message);
