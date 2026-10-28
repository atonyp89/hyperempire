import { useState } from 'react';
import { DAILY_EMISSION, MASTERIES, STARTER_AURA } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { API_MODE } from '../../shared/api';
import type { UpgradeResult, useTownhall } from '../hooks/useTownhall';
import { BuildingModal } from '../../shared/ui/BuildingModal';

type Townhall = ReturnType<typeof useTownhall>;
type Props = { open: boolean; onClose: () => void; townhall: Townhall };

export function TownhallModal({ open, onClose, townhall: t }: Props) {
  return (
    <BuildingModal open={open} onClose={onClose} title="THE TOWNHALL" subtitle={<>Level up your empire · raise every building’s Mastery cap · more Mastery XP</>}>
      {t.ready ? (
        <div className="th-grid">
          <Overview t={t} />
          <Upgrade t={t} />
          <Gives t={t} />
          <Masteries t={t} />
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
        $aura = {fmtAura(STARTER_AURA)} starter + your share of each day’s {fmtAura(DAILY_EMISSION)} $aura Exchange pool (split by builder fees paid) − what you spend. Progress is kept by
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
        <div className="small muted">
          Every Mastery up to <span className="gold">LV {t.masteryCap}</span> · <span className="gold">+{pct1(t.masteryXpBonus)}</span> Mastery XP
        </div>
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
          {result.ok ? `Success! Townhall is now LV ${result.level}. Mastery cap LV ${result.level}.` : `Failed. ${fmtAura(result.spent)} $aura burned. Try again?`}
        </div>
      )}
    </section>
  );
}

const pct1 = (f: number) => `${Math.round(f * 100)}%`;

/** What the Townhall level gives, now and at the next level. */
function Gives({ t }: { t: Townhall }) {
  const rows = [
    { what: 'Mastery cap', now: `LV ${t.masteryCap}`, next: `LV ${t.masteryCap + 1}`, about: 'No building’s Mastery can be higher than your Townhall. XP earned past the cap is kept and counts once you upgrade.' },
    { what: 'Mastery XP bonus', now: `+${pct1(t.masteryXpBonus)}`, next: `+${pct1(t.masteryXpBonus + 0.01)}`, about: '+1% Mastery XP in every building per Townhall level.' },
  ];
  return (
    <section className="panel th-gives" aria-label="What your Townhall level gives">
      <div className="label">WHAT YOUR LEVEL GIVES</div>
      <table className="th-gives-table">
        <thead>
          <tr>
            <th />
            <th>NOW · LV {t.level}</th>
            <th>NEXT · LV {t.level + 1}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what} title={r.about}>
              <td>
                <div className="strong">{r.what}</div>
                <div className="muted small">{r.about}</div>
              </td>
              <td className="mono gold">{r.now}</td>
              <td className="mono">{r.next}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small muted">Coming later: your Townhall grows grander in the town as it levels up.</div>
    </section>
  );
}

/** Every building's Mastery: earned by using that building, capped by the Townhall level. */
function Masteries({ t }: { t: Townhall }) {
  return (
    <section className="panel th-masteries" aria-label="Mastery">
      <div className="th-masteries-head">
        <span className="label">MASTERY · EARNED BY USING EACH BUILDING · CAPPED AT LV {t.masteryCap}</span>
      </div>
      <div className="masteries">
        {MASTERIES.map((m) => {
          const v = t.masteries.find((x) => x.id === m.id);
          const level = v?.level ?? 0;
          const locked = m.opensAt !== undefined && t.level < m.opensAt;
          return (
            <article key={m.id} className={`mastery ${v?.live ? 'live' : 'soon'}`} aria-label={`${m.name} Mastery`}>
              <div className="mastery-head">
                <img className="mastery-sprite" src={m.sprite} alt="" aria-hidden="true" />
                <div className="mastery-title">
                  <span className="mastery-name">{m.name}</span>
                  <span className="mono small">
                    LV {level} <span className="muted">/ {t.masteryCap}</span>
                  </span>
                </div>
              </div>
              <div className="mastery-bar" role="progressbar" aria-label={`${m.name} Mastery toward the cap`} aria-valuemin={0} aria-valuemax={t.masteryCap} aria-valuenow={level}>
                <div className="mastery-bar-fill" style={{ width: `${t.masteryCap ? Math.min(100, (level / t.masteryCap) * 100) : 0}%` }} />
              </div>
              <div className="small">
                <span className="muted">XP from </span>
                {m.xpFrom}
              </div>
              <ul className="mastery-perks small muted">
                {m.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <span className={`phase ${v?.live ? 'live' : ''}`}>{v?.live ? 'LIVE' : locked ? `OPENS AT LV ${m.opensAt}` : 'COMING SOON'}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
