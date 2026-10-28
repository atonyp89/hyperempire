// Exchange Mastery: earned by paying builder fees, capped by the Townhall. Points buy a lower builder fee or
// more weight in the daily $aura pool for your trading style.

import { EXCHANGE_PERKS, WHALE_DAILY_VOLUME, XP_PER_USD_FEE } from '@server/contract';
import { BUILDER_FEE_RATE } from '../../trading';
import { fmtAura, fmtNum } from '../../shared/format';
import { useMastery } from '../hooks/useMastery';

const pct = (f: number) => `${Math.round(f * 100)}%`;

export function ExchangeMastery() {
  const { session, m, loading, busy, error, addRank, respec } = useMastery('exchange');

  if (!session.signedIn) {
    return (
      <div className="game">
        <section className="panel ex-mastery ex-mastery-empty">
          <img className="ex-mastery-sprite" src="/empire/exchange.png" alt="" aria-hidden="true" />
          <div className="muted">{session.address ? 'Sign in to see your Exchange Mastery.' : 'Connect your wallet to see your Exchange Mastery.'}</div>
          {session.address && (
            <button type="button" className="btn primary" disabled={session.signingIn} onClick={() => void session.signIn()}>
              {session.signingIn ? 'CHECK YOUR WALLET…' : 'SIGN IN'}
            </button>
          )}
        </section>
      </div>
    );
  }
  if (loading || !m) return <div className="muted pad">Loading Exchange Mastery…</div>;

  const capped = m.uncappedLevel > m.level;
  const bar = capped ? 100 : Math.min(100, (m.xpIntoLevel / m.xpForNext) * 100);
  const rankOf = (id: string) => m.ranks[id] ?? 0;
  const yourRate = (m.feeTenthsBps ?? 0) / 100_000;

  return (
    <div className="game">
      <div className="ex-mastery">
        <section className="panel ex-mastery-head" aria-label="Exchange Mastery level">
          <img className="ex-mastery-sprite" src="/empire/exchange.png" alt="" aria-hidden="true" />
          <div className="ex-mastery-level">
            <div className="th-level">
              <span className="title-pixel">MASTERY LV {m.level}</span>
              <span className="label">TOWNHALL CAP LV {m.cap}</span>
            </div>
            <div className="th-bar" role="progressbar" aria-label="XP toward the next Mastery level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bar)}>
              <div className="th-bar-fill" style={{ width: `${bar}%` }} />
            </div>
            <div className="th-bar-legend mono small">
              <span>{fmtNum(m.xp, 0)} XP</span>
              <span className="muted">{capped ? `XP for LV ${m.uncappedLevel} is saved` : `${fmtNum(m.xpIntoLevel, 0)} / ${fmtNum(m.xpForNext, 0)} to LV ${m.level + 1}`}</span>
            </div>
            <div className="small muted">
              {XP_PER_USD_FEE} XP per $1 of builder fee (counted at the full rate) · <span className="gold">+{pct(m.xpBonus)}</span> from your Townhall
            </div>
            {capped && (
              <div className="notice small">
                Your XP is worth <b>LV {m.uncappedLevel}</b>, but Mastery can’t pass your Townhall (LV {m.cap}). Upgrade the Townhall to unlock it.
              </div>
            )}
          </div>
        </section>

        <section className="panel ex-mastery-perks" aria-label="Exchange Mastery perks">
          <div className="ex-perks-head">
            <span className="label">
              PERKS · {m.points} POINT{m.points === 1 ? '' : 'S'} TO SPEND
            </span>
            <button type="button" className="btn ghost small" disabled={busy || Object.keys(m.ranks).length === 0} onClick={respec}>
              RESPEC · {fmtAura(m.respecCost)} $AURA
            </button>
          </div>
          {EXCHANGE_PERKS.map((p) => {
            const r = rankOf(p.id);
            const full = r >= p.maxRank;
            return (
              <div key={p.id} className={`perk ${r > 0 ? 'has' : ''}`}>
                <img className="icon32" src={p.icon} alt="" aria-hidden="true" />
                <div className="perk-body">
                  <div className="perk-name">
                    {p.name} <span className="mono small rank">{r}/{p.maxRank}</span>
                  </div>
                  <div className="muted small">{p.effect}</div>
                </div>
                <button
                  type="button"
                  className="btn small plus"
                  disabled={busy || full || m.points < 1}
                  onClick={() => addRank(p.id)}
                  aria-label={`Add a rank to ${p.name}`}
                >
                  +
                </button>
              </div>
            );
          })}
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
        </section>

        <section className="panel ex-mastery-now" aria-label="What your perks do now">
          <div className="label">WHAT YOUR PERKS DO NOW</div>
          <dl className="ex-mastery-dl">
            <div>
              <dt>Your builder fee</dt>
              <dd className="mono">
                {(yourRate * 100).toFixed(3)}%{' '}
                {(m.feeDiscount ?? 0) > 0 && <span className="gold">(−{pct(m.feeDiscount ?? 0)} of {(BUILDER_FEE_RATE * 100).toFixed(3)}%)</span>}
              </dd>
            </div>
            <div>
              <dt>Pool weight on maker fills</dt>
              <dd className="mono">+{pct(rankOf('market-maker') * 0.03)}</dd>
            </div>
            <div>
              <dt>Pool weight on taker fills</dt>
              <dd className="mono">+{pct(rankOf('taker') * 0.03)}</dd>
            </div>
            <div>
              <dt>Whale (days with ${fmtNum(WHALE_DAILY_VOLUME, 0)}+ volume)</dt>
              <dd className="mono">+{pct(rankOf('whale') * 0.03)}</dd>
            </div>
          </dl>
          <div className="small muted">
            The daily pool is fixed, so weight bonuses shift shares between traders and never add $aura. A discount never lowers your share: fills count at the full fee.
          </div>
        </section>
      </div>
    </div>
  );
}
