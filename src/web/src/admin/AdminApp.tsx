// The admin dashboard: sign in with the admin username and password, then browse every table (schema and rows),
// see $aura totals, and run read-only SQL. It talks to the API's /admin routes, so it works the same against the
// in-browser server and a deployed one. The login stays in memory only: reloading the page asks again.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AdminOverview, AdminQueryResult, AdminRows, AdminTable } from '@server/contract';
import { api, API_MODE, ApiRequestError } from '../shared/api';
import { fmtAura } from '../shared/format';
import { NETWORK } from '../shared/network';

type View = { kind: 'overview' } | { kind: 'sql' } | { kind: 'table'; name: string };

const basic = (user: string, password: string) => `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${user}:${password}`)))}`;

export function AdminApp() {
  const [auth, setAuth] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      try {
        return await api<T>(`/admin${path}`, { body, authorization: auth ?? undefined });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) setAuth(null);
        throw err;
      }
    },
    [auth],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setOverview(await call<AdminOverview>('/overview'));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [call]);

  useEffect(() => {
    if (auth) void refresh();
  }, [auth, refresh]);

  if (!auth) return <Login onSignIn={setAuth} />;

  return (
    <div className="admin">
      <header className="adm-head">
        <span className="title-pixel">HYPEREMPIRE ADMIN</span>
        <span className="chip">{NETWORK.toUpperCase()}</span>
        <span className="chip muted">{API_MODE === 'local' ? 'IN-BROWSER SERVER' : 'REMOTE SERVER'}</span>
        <span className="chip muted">READ ONLY</span>
        <span className="adm-spacer" />
        <button type="button" className="btn ghost small" onClick={() => void refresh()}>
          REFRESH
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            setAuth(null);
            setOverview(null);
          }}
        >
          SIGN OUT
        </button>
      </header>
      <div className="adm-body">
        <nav className="adm-nav panel" aria-label="Tables">
          <NavItem on={view.kind === 'overview'} onClick={() => setView({ kind: 'overview' })}>
            Overview
          </NavItem>
          <NavItem on={view.kind === 'sql'} onClick={() => setView({ kind: 'sql' })}>
            SQL query
          </NavItem>
          <div className="label adm-nav-label">TABLES</div>
          {overview?.tables.map((t) => (
            <NavItem key={t.name} on={view.kind === 'table' && view.name === t.name} onClick={() => setView({ kind: 'table', name: t.name })}>
              <span>{t.name}</span>
              <span className="muted">{t.rows.toLocaleString('en-US')}</span>
            </NavItem>
          ))}
        </nav>
        <main className="adm-main">
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
          {view.kind === 'overview' && overview && <Overview o={overview} open={(name) => setView({ kind: 'table', name })} />}
          {view.kind === 'sql' && <Sql call={call} />}
          {view.kind === 'table' && overview && <TableView key={view.name} table={overview.tables.find((t) => t.name === view.name)} call={call} />}
        </main>
      </div>
    </div>
  );
}

function NavItem({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`adm-nav-item ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>
      {children}
    </button>
  );
}

function Login({ onSignIn }: { onSignIn: (auth: string) => void }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const auth = basic(user, password);
    try {
      await api('/admin/overview', { authorization: auth });
      onSignIn(auth);
    } catch (err) {
      const status = err instanceof ApiRequestError ? err.status : 0;
      setError(
        status === 404
          ? API_MODE === 'local'
            ? 'The admin dashboard is off. Set ADMIN_USER and ADMIN_PASSWORD (12+ characters) in src/web/.env.local, then restart the dev server.'
            : 'The admin dashboard is off on this server. Set ADMIN_USER and ADMIN_PASSWORD (12+ characters) there.'
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin">
      <div className="adm-login-wrap">
        <form className="panel adm-login" onSubmit={(e) => void submit(e)}>
          <span className="title-pixel">ADMIN</span>
          <div className="muted small">
            HyperEmpire database, {NETWORK} · {API_MODE === 'local' ? 'in-browser server' : 'remote server'}
          </div>
          <label className="adm-field">
            <span className="label">USERNAME</span>
            <input className="input" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
          </label>
          <label className="adm-field">
            <span className="label">PASSWORD</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'CHECKING…' : 'SIGN IN'}
          </button>
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Overview({ o, open }: { o: AdminOverview; open: (name: string) => void }) {
  const count = (name: string) => o.tables.find((t) => t.name === name)?.rows ?? 0;
  const minted = o.ledgerByKind.filter((k) => k.total > 0).reduce((s, k) => s + k.total, 0);
  const burned = -o.ledgerByKind.filter((k) => k.total < 0).reduce((s, k) => s + k.total, 0);
  return (
    <>
      <div className="adm-stats">
        <Stat label="PLAYERS" value={count('accounts').toLocaleString('en-US')} />
        <Stat label="$AURA SUPPLY" value={fmtAura(o.auraSupply)} />
        <Stat label="MINTED" value={fmtAura(minted)} />
        <Stat label="BURNED" value={fmtAura(burned)} />
        <Stat label="MINERS" value={count('miners').toLocaleString('en-US')} />
        <Stat label="PICKS" value={count('picks').toLocaleString('en-US')} />
        <Stat label="LAST SETTLED BLOCK" value={o.settledHeight?.toLocaleString('en-US') ?? '—'} />
      </div>
      <section className="panel pad">
        <div className="label">$AURA BY LEDGER KIND</div>
        <table className="adm-grid">
          <thead>
            <tr>
              <th>kind</th>
              <th className="num">total $aura</th>
              <th className="num">entries</th>
            </tr>
          </thead>
          <tbody>
            {o.ledgerByKind.map((k) => (
              <tr key={k.kind}>
                <td>{k.kind}</td>
                <td className={`num ${k.total < 0 ? 'down' : 'up'}`}>
                  {k.total > 0 ? '+' : ''}
                  {fmtAura(k.total)}
                </td>
                <td className="num">{k.entries.toLocaleString('en-US')}</td>
              </tr>
            ))}
            {o.ledgerByKind.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No ledger entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="panel pad">
        <div className="label">TABLES</div>
        <table className="adm-grid">
          <thead>
            <tr>
              <th>table</th>
              <th className="num">rows</th>
              <th>columns</th>
            </tr>
          </thead>
          <tbody>
            {o.tables.map((t) => (
              <tr key={t.name} className="adm-link" onClick={() => open(t.name)}>
                <td>{t.name}</td>
                <td className="num">{t.rows.toLocaleString('en-US')}</td>
                <td className="muted">{t.columns.map((c) => c.name).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel adm-stat">
      <span className="label">{label}</span>
      <span className="mono big">{value}</span>
    </div>
  );
}

type Call = <T>(path: string, body?: unknown) => Promise<T>;

const PAGE = 50;
/** Columns stored in milli-$aura (1,000 = 1 $aura). */
const MILLI: Record<string, string[]> = { accounts: ['balance'], ledger: ['delta'], rush_wins: ['amount'] };

function TableView({ table, call }: { table: AdminTable | undefined; call: Call }) {
  const [order, setOrder] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminRows | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!table) return;
    const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (order) (q.set('order', order.col), q.set('dir', order.dir));
    call<AdminRows>(`/tables/${encodeURIComponent(table.name)}?${q}`).then(setData, (err: Error) => setError(err.message));
  }, [table, order, offset, call]);

  if (!table) return <div className="notice err">That table doesn’t exist any more.</div>;
  const sortBy = (col: string) => {
    setOffset(0);
    setOrder((o) => (o?.col === col ? { col, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' }));
  };
  const shownCol = order?.col ?? table.columns[0]?.name;
  const shownDir = order?.dir ?? 'desc';

  return (
    <>
      <section className="panel pad">
        <div className="adm-title">
          <span className="title-pixel">{table.name}</span>
          <span className="muted">{table.rows.toLocaleString('en-US')} rows</span>
        </div>
        <details className="adm-schema">
          <summary className="label">
            SCHEMA · {table.columns.length} COLUMNS · {table.indexes.length} INDEXES
          </summary>
          <table className="adm-grid">
            <thead>
              <tr>
                <th>column</th>
                <th>type</th>
                <th>null</th>
                <th>default</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="gold">{c.type}</td>
                  <td>{c.nullable ? 'yes' : 'no'}</td>
                  <td className="muted">{c.default ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {table.indexes.map((i) => (
            <div key={i} className="mono small muted adm-index">
              {i}
            </div>
          ))}
        </details>
      </section>
      {error && (
        <div className="notice err" role="alert">
          {error}
        </div>
      )}
      {data && (
        <section className="panel pad">
          <div className="adm-pager">
            <span className="muted small">
              {data.total === 0
                ? 'No rows'
                : `Rows ${(offset + 1).toLocaleString('en-US')}–${Math.min(offset + PAGE, data.total).toLocaleString('en-US')} of ${data.total.toLocaleString('en-US')}`}{' '}
              · sorted by {shownCol} {shownDir}
            </span>
            <span className="adm-spacer" />
            <button type="button" className="btn ghost small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              ← PREV
            </button>
            <button type="button" className="btn ghost small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
              NEXT →
            </button>
          </div>
          {MILLI[table.name] && <div className="muted small adm-pager">{MILLI[table.name].join(', ')} in milli-$aura: 1,000 = 1 $aura.</div>}
          <Grid columns={data.columns} rows={data.rows} sort={{ col: shownCol, dir: shownDir, by: sortBy }} />
        </section>
      )}
    </>
  );
}

const EXAMPLES: { label: string; sql: string }[] = [
  { label: 'Richest players', sql: 'SELECT address, round(balance / 1000.0, 3) AS aura FROM accounts ORDER BY balance DESC LIMIT 20' },
  { label: 'Latest ledger', sql: 'SELECT id, address, kind, round(delta / 1000.0, 3) AS aura, ref, created_at FROM ledger ORDER BY id DESC LIMIT 50' },
  { label: 'Miners by pool', sql: "SELECT coalesce(pool, '(home)') AS pool, grade, count(*) FROM miners GROUP BY 1, 2 ORDER BY 1, 2" },
  { label: 'Townhall levels', sql: 'SELECT level, count(*) AS players FROM townhalls GROUP BY level ORDER BY level' },
];

function Sql({ call }: { call: Call }) {
  const [text, setText] = useState(EXAMPLES[0].sql);
  const [result, setResult] = useState<AdminQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await call<AdminQueryResult>('/query', { sql: text }));
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel pad adm-sql">
        <div className="adm-title">
          <span className="label">SQL · READ ONLY · ONE STATEMENT · FIRST 500 ROWS</span>
          <span className="adm-spacer" />
          {EXAMPLES.map((e) => (
            <button key={e.label} type="button" className="btn ghost small" onClick={() => setText(e.sql)}>
              {e.label}
            </button>
          ))}
        </div>
        <textarea
          className="input mono adm-sql-text"
          aria-label="SQL query"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run();
          }}
        />
        <div className="adm-title">
          <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={() => void run()}>
            {busy ? 'RUNNING…' : 'RUN'}
          </button>
          <span className="muted small">⌘/Ctrl + Enter. Writes are refused: the query runs in a read-only transaction.</span>
        </div>
      </section>
      {error && (
        <div className="notice err" role="alert">
          {error}
        </div>
      )}
      {result && (
        <section className="panel pad">
          <div className="muted small adm-pager">
            {result.rowCount.toLocaleString('en-US')} row{result.rowCount === 1 ? '' : 's'}
            {result.truncated ? ' (first 500 shown)' : ''} · {result.ms} ms
          </div>
          <Grid columns={result.columns} rows={result.rows} />
        </section>
      )}
    </>
  );
}

function Grid({
  columns,
  rows,
  sort,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  sort?: { col: string | undefined; dir: 'asc' | 'desc'; by: (col: string) => void };
}) {
  return (
    <div className="adm-scroll">
      <table className="adm-grid">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} aria-sort={sort?.col === c ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {sort ? (
                  <button type="button" className="adm-sort" onClick={() => sort.by(c)}>
                    {c} {sort.col === c ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                ) : (
                  c
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <Cell key={c} v={r[c]} />
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="muted">
                No rows.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ v }: { v: unknown }) {
  if (v === null || v === undefined) return <td className="muted">null</td>;
  if (typeof v === 'number') return <td className="num">{v.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>;
  if (typeof v === 'boolean') return <td>{String(v)}</td>;
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return <td title={s.length > 48 ? s : undefined}>{s.length > 48 ? `${s.slice(0, 46)}…` : s}</td>;
}
