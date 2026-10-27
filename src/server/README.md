# HyperEmpire API

The game backend: wallet sign-in, the $aura ledger, the Townhall and mining. This page covers running and deploying it; how it works is in [docs/backend](../../docs/backend/README.md). TypeScript on [Bun](https://bun.sh) with [Hono](https://hono.dev), [Drizzle](https://orm.drizzle.team) and Postgres.

The same app runs in two places:

| Where | Database | Used when |
| --- | --- | --- |
| **In the browser** (`src/local.ts`) | [PGlite](https://pglite.dev) (Postgres in WebAssembly) saved in IndexedDB | Development: the web app's default, `VITE_API_URL=local` |
| **On a server** (`src/main.ts`) | Postgres from `DATABASE_URL`, or PGlite in `./data/` without it | Production (AWS), or running the API on its own |

Both go through `createApp()` in `src/app.ts` and real `Request`/`Response` objects, so moving to production means deploying this folder with a database and setting `VITE_API_URL` in the web app. The client code doesn't change.

## Run

```bash
bun install
bun test                 # end-to-end API tests on an in-memory database
bun run typecheck
bun run dev              # http://localhost:8787, PGlite in ./data/
```

| Variable | Default | What |
| --- | --- | --- |
| `NETWORK` | `testnet` | Hyperliquid network whose fills earn $aura. Run one server per network. |
| `PORT` | `8787` | HTTP port |
| `DATABASE_URL` | none | Postgres connection string. Without it, PGlite in `./data/<network>` (git-ignored). |
| `ALLOWED_ORIGINS` | none | Comma-separated web origins allowed by CORS, e.g. `https://hyperempire.xyz` |

To point the web app at it, set `VITE_API_URL=http://localhost:8787` in `src/web/.env.local` and add `ALLOWED_ORIGINS=http://localhost:5173` here.

## Deploying to AWS

1. A Postgres database (RDS, or Aurora Serverless), one per network or one database per network on the same instance.
2. This folder as a container or on an instance with Bun: `bun install --production && bun src/main.ts`, with `NETWORK`, `DATABASE_URL`, `ALLOWED_ORIGINS` and `PORT` set. Migrations run on start.
3. Behind HTTPS (an ALB or CloudFront). Run **one instance per network** for now: the 60 s block timer and the fee-sync rate limit live in memory.
4. Build the web app with `VITE_API_URL=https://<api host>`.

## More

- [docs/backend](../../docs/backend/README.md): architecture, code layout, sign-in, the $aura ledger, mining blocks, data model and errors.
- [docs/backend/endpoints.md](../../docs/backend/endpoints.md): every endpoint, with requests and responses.
