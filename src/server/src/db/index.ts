// The database handle the app uses, whichever driver opened it: PGlite (browser and tests) or postgres-js
// (production). Both are Drizzle Postgres databases over the same schema.

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Either the database or an open transaction; helpers that only read and write take this. */
export type Conn = Db | Tx;
