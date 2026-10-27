import { useState } from 'react';
import { AURA_PER_USD_FEE, BUILDER_FEE_RATE } from '../../trading';
import { BRANCHES, BUILDING_CAPS, STARTER_AURA, FEE_DISCOUNT_CAP, PERKS, TIER_POINTS, branchSpent } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { API_MODE } from '../../shared/api';
import type { UpgradeResult, useTownhall } from '../hooks/useTownhall';
import { BuildingModal } from '../../shared/ui/BuildingModal';

type Townhall = ReturnType<typeof useTownhall>;
type Props = { open: boolean; onClose: () => void; townhall: Townhall };

export function TownhallModal({ open, onClose, townhall: t }: Props) {
  return (
    <BuildingModal open={open} onClose={onClose} title="THE TOWNHALL" subtitle={<>Level up your empire · earn perk points · set building caps</>}>
      {t.ready ? (
        <div className="th-grid">
          <Overview t={t} />
          <Upgrade t={t} />
          <Perks t={t} />
          <Caps t={t} />
        </div>
      ) : (
        <SignIn t={t} />
      )}
      {t.error && t.ready && (
        <div className="notice err" role="alert">
          {t.error}
        </div>
      )}
      <p className="muted small th-note">
        $aura = {fmtAura(STARTER_AURA)} starter + {fmtAura(AURA_PER_USD_FEE)} per $1 of builder fees on your fills − what you spend. Progress is kept by
        the HyperEmpire server{API_MODE === 'local' ? ' (running in this browser while in development)' : ''}.
      </p>
    </BuildingModal>
  );
}

/** Before the Townhall loads: connect a wallet, then sign one message to start a session. */
function SignIn({ t }: { t: Townhall }) {
  const s = t.session;
  return (
    <section className="panel th-signin" aria-label="Sign in">
      <img className="th-sprite" src="/empire/townhall.png" alt="Your Townhall" />
      {!s.address ? (
        <div className="muted">Connect your wallet to enter your Townhall.</div>
      ) : t.loading ? (
        <div className="muted">Opening your Townhall…</div>
      ) : (
        <>
          <div className="muted small">Sign a message with your wallet to prove it’s you. It’s free and sends no transaction.</div>
          <button type="button" className="btn primary big" disabled={s.signingIn} onClick={() => void s.signIn()}>
            {s.signingIn ? 'CHECK YOUR WALLET…' : 'SIGN IN'}
          </button>
          {(s.error ?? t.error) && (
            <div className="notice err" role="alert">
              {s.error ?? t.error}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Overview({ t }: { t: Townhall }) {
  const pct = t.nextCost ? Math.min(100, Math.round((t.balance / t.nextCost) * 100)) : 0;
  return (
    <section className="panel th-overview" aria-label="Townhall level">
      <img className="th-sprite" src="/empire/townhall.png" alt="Your Townhall" />
      <div className="th-ov-body">
        <div className="th-level">
          <span className="title-pixel">LV {t.level}</span>
          <span className="label">SEASON 0 · RANK —</span>
        </div>
        <div className="th-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="$aura toward the next level">
          <div className="th-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="th-bar-legend mono small">
          <span>
            <span className="gem" aria-hidden="true" /> {fmtAura(t.balance)} $aura
          </span>
          <span className="muted">next level {fmtAura(t.nextCost)}</span>
        </div>
        <div className="small muted">{t.points > 0 ? <span className="gold">{t.points} perk point{t.points === 1 ? '' : 's'} to spend</span> : 'All perk points spent'}</div>
      </div>
    </section>
  );
}

const CHANCES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function Upgrade({ t }: { t: Townhall }) {
  const [chance, setChance] = useState(100);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const attempt = Math.round((t.nextCost * chance) / 100);
  const affordable = attempt <= t.balance;
  const go = async () => {
    setResult(null);
    setResult(await t.upgrade(chance).catch(() => null));
  };

  return (
    <section className="panel th-upgrade" aria-label="Upgrade the Townhall">
      <div className="label">UPGRADE TO LV {t.level + 1}</div>
      <div className="small muted">Pay part of the cost for the same chance. The $aura burns either way. 100% is a sure level.</div>
      <div className="chance-row" role="group" aria-label="Success chance">
        {CHANCES.map((c) => {
          const can = Math.round((t.nextCost * c) / 100) <= t.balance;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={c === chance}
              className={`chance ${c === chance ? 'on' : ''} ${can ? '' : 'cant'}`}
              onClick={() => setChance(c)}
            >
              {c}%
            </button>
          );
        })}
      </div>
      <div className="th-cost mono">
        <span className="muted">Cost</span> <span className="gold">{fmtAura(attempt)} $aura</span> <span className="muted">· {chance}% chance</span>
      </div>
      <button type="button" className="btn primary big" disabled={!affordable || t.busy} onClick={() => void go()}>
        {t.busy ? 'ROLLING…' : affordable ? (chance === 100 ? 'UPGRADE' : `TRY UPGRADE · ${chance}%`) : 'NOT ENOUGH $AURA'}
      </button>
      {result && (
        <div className={`notice ${result.ok ? 'ok' : 'err'}`} role="status">
          {result.ok ? `Success! Townhall is now LV ${result.level}. +1 perk point.` : `Failed. ${fmtAura(result.spent)} $aura burned. Try again?`}
        </div>
      )}
    </section>
  );
}

function Perks({ t }: { t: Townhall }) {
  const feeDiscount = Math.min(FEE_DISCOUNT_CAP, (t.ranks['lower-fees'] ?? 0) * 0.01);
  return (
    <section className="panel th-perks" aria-label="Perks">
      <div className="th-perks-head">
        <span className="label">PERKS · {t.points} POINT{t.points === 1 ? '' : 'S'} TO SPEND</span>
        <button type="button" className="btn ghost small" disabled={t.busy || Object.keys(t.ranks).length === 0 || t.respec > t.balance} onClick={() => t.doRespec()}>
          RESPEC · {fmtAura(t.respec)}
        </button>
      </div>
      <div className="branches">
        {BRANCHES.map((b) => {
          const spent = branchSpent(t.ranks, b.id);
          return (
            <div key={b.id} className={`branch ${b.live ? '' : 'later'}`}>
              <div className="branch-head">
                <img className="icon32" src={b.icon} alt="" aria-hidden="true" />
                <div>
                  <div className="branch-name">{b.name} <span className="muted small">· {spent} pts</span></div>
                  <div className="muted small">{b.who}</div>
                </div>
                <span className={`phase ${b.live ? 'live' : ''}`}>{b.phase}</span>
              </div>
              {[1, 2, 3].map((tier) => {
                const need = TIER_POINTS[tier as 1 | 2 | 3];
                const open = spent >= need;
                return (
                  <div key={tier} className="tier">
                    {tier > 1 && <div className={`tier-gate ${open ? 'open' : ''}`}>{open ? `TIER ${tier}` : `TIER ${tier} · ${need} PTS IN ${b.name}`}</div>}
                    {PERKS.filter((p) => p.branch === b.id && p.tier === tier).map((p) => {
                      const rank = t.ranks[p.id] ?? 0;
                      return (
                        <div key={p.id} className={`perk ${open ? '' : 'locked'} ${rank > 0 ? 'has' : ''}`}>
                          <img className="icon32" src={p.icon} alt="" aria-hidden="true" />
                          <div className="perk-body">
                            <div className="perk-name">
                              {p.name} <span className="mono small rank">{rank}/{p.maxRank}</span>
                            </div>
                            <div className="muted small">{p.effect}</div>
                          </div>
                          <button type="button" className="btn small plus" disabled={!t.canRank(p.id)} onClick={() => t.addRank(p.id)} aria-label={`Add a rank to ${p.name}`}>
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="small muted">
        Builder fee with your perks: <span className="mono gold">{(BUILDER_FEE_RATE * (1 - feeDiscount) * 100).toFixed(4)}%</span> (−{Math.round(feeDiscount * 100)}%, max −
        {FEE_DISCOUNT_CAP * 100}% with the Exchange). Fighter and Crafter points bank now and work when heroes and crafting arrive.
      </div>
    </section>
  );
}

function Caps({ t }: { t: Townhall }) {
  return (
    <section className="panel th-caps" aria-label="Building caps">
      <div className="label">BUILDING CAPS</div>
      {BUILDING_CAPS.map((c) => {
        const unlocked = t.level >= c.unlockAt;
        return (
          <div key={c.name} className="cap-row">
            <span className="strong">{c.name}</span>
            <span className={`mono small ${unlocked ? '' : 'muted'}`}>{unlocked ? `up to LV ${t.level}` : `unlocks at Townhall LV ${c.unlockAt}`}</span>
          </div>
        );
      })}
      <div className="small muted">The Townhall caps every other building’s level, so it is always the first upgrade.</div>
    </section>
  );
}
