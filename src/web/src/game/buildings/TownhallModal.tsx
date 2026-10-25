import { useState } from 'react';
import { BUILDER_FEE_RATE } from '../../trading';
import { BRANCHES, BUILDING_CAPS, FEE_DISCOUNT_CAP, PERKS, TIER_POINTS, branchSpent } from '../lib/empire';
import { fmtAura } from '../../shared/format';
import type { UpgradeResult, useTownhall } from '../hooks/useTownhall';
import { BuildingModal } from '../../shared/ui/BuildingModal';

type Townhall = ReturnType<typeof useTownhall>;
type Props = { open: boolean; onClose: () => void; townhall: Townhall };

export function TownhallModal({ open, onClose, townhall: t }: Props) {
  return (
    <BuildingModal open={open} onClose={onClose} title="THE TOWNHALL" subtitle={<>Level up your empire · earn perk points · set building caps</>}>
      <div className="th-grid">
        <Overview t={t} />
        <Upgrade t={t} />
        <Perks t={t} />
        <Caps t={t} />
      </div>
      <p className="muted small th-note">
        Preview: Townhall progress is saved in this browser until the Townhall contract ships. $aura here = {fmtAura(5000)} starter + estimated
        $aura from your fills − what you spend in the Townhall.
      </p>
    </BuildingModal>
  );
}

function Overview({ t }: { t: Townhall }) {
  const pct = Math.min(100, Math.round((t.balance / t.nextCost) * 100));
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
      <button type="button" className="btn primary big" disabled={!affordable} onClick={() => setResult(t.upgrade(chance))}>
        {affordable ? (chance === 100 ? 'UPGRADE' : `TRY UPGRADE · ${chance}%`) : 'NOT ENOUGH $AURA'}
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
        <button type="button" className="btn ghost small" disabled={Object.keys(t.ranks).length === 0 || t.respec > t.balance} onClick={() => t.doRespec()}>
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
