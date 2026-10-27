// The Hono environment shared by every route: injected deps, and the signed-in wallet once auth has run.

import type { Deps } from './deps';

export type Env = { Variables: { deps: Deps; address: string } };
