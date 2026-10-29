// The Garden screen: a 4x4 field where seeds bought with $gold grow on the clock and are harvested into the
// inventory. One crop (wheat) for now; more come later.

import { useState } from 'react';
import { CROPS, type CropId } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { useGarden, type Garden } from '../hooks/useGarden';
import { GardenField, timeLeft } from './GardenField';

type Props = { open: boolean; onClose: () => void };

export function GardenModal({ open, onClose }: Props) {
  const g = useGarden(open);
  return (
    <BuildingModal open={open} onClose={onClose} title="THE GARDEN" subtitle={<>Plant seeds with $gold · watch them grow · harvest your crops</>}>
      {g.ready ? <Field g={g} /> : <SignIn g={g} />}
      {g.error && g.ready && (
        <div className="notice err garden-err" role="alert">
          {g.error}
        </div>
      )}
    </BuildingModal>
  );
}

function SignIn({ g }: { g: Garden }) {
  const s = g.session;
  return (
    <section className="panel th-signin" aria-label="Sign in">
      {!s.address ? (
        <div className="muted">Connect your wallet to enter your Garden.</div>
      ) : g.loading ? (
        <div className="muted">Opening your Garden…</div>
      ) : (
        <>
          <div className="muted small">Sign a message with your wallet to prove it’s you. It’s free and sends no transaction.</div>
          <button type="button" className="btn primary big" disabled={s.signingIn} onClick={() => void s.signIn()}>
            {s.signingIn ? 'CHECK YOUR WALLET…' : 'SIGN IN'}
          </button>
        </>
      )}
    </section>
  );
}

const SEEDS = Object.values(CROPS);

function Field({ g }: { g: Garden }) {
  const [seed, setSeed] = useState<CropId>('wheat');
  const crop = CROPS[seed];
  const empty = g.plots.filter((p) => !p.crop).map((p) => p.slot);
  const ripe = g.plots.filter((p) => p.ripe).map((p) => p.slot);
  const growing = g.plots.filter((p) => p.crop && !p.ripe);
  const nextRipe = growing.reduce((m, p) => Math.min(m, p.readyAt ?? Infinity), Infinity);
  const affordable = Math.min(empty.length, Math.floor(g.gold / crop.seedGold));
  const items = Object.entries(g.inventory);

  return (
    <div className="garden-grid">
      <GardenField
        plots={g.plots}
        now={g.now}
        busy={g.busy}
        seedName={g.gold >= crop.seedGold ? crop.name : null}
        onPlant={(slot) => g.plant(seed, [slot])}
        onHarvest={(slot) => g.harvest([slot])}
      />
      <div className="garden-side">
        <section className="panel garden-panel" aria-label="Seeds">
          <div className="label">SEEDS</div>
          <div className="seed-list" role="radiogroup" aria-label="Seed to plant">
            {SEEDS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === seed} className={`seed ${c.id === seed ? 'on' : ''}`} onClick={() => setSeed(c.id)}>
                <span className="seed-icon" style={{ backgroundImage: `url(${c.sprite})`, backgroundSize: `${c.stages * 100}% 100%`, backgroundPositionX: '100%' }} aria-hidden="true" />
                <span className="seed-body">
                  <span className="strong">{c.name}</span>
                  <span className="muted small">
                    <span className="coin" aria-hidden="true" /> {c.seedGold} $gold · ripe in {timeLeft(c.growMs)} · {c.yield} per plant
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="small muted">Click an empty plot to plant, a ripe one to harvest.</div>
          <div className="garden-actions">
            <button type="button" className="btn primary" disabled={g.busy || affordable === 0} onClick={() => g.plant(seed, empty.slice(0, affordable))}>
              {empty.length === 0
                ? 'EVERY PLOT IS PLANTED'
                : affordable === 0
                  ? 'NOT ENOUGH $GOLD'
                  : `PLANT ${affordable} ${crop.name.toUpperCase()} · ${fmtAura(affordable * crop.seedGold)} $GOLD`}
            </button>
            <button type="button" className="btn" disabled={g.busy || ripe.length === 0} onClick={() => g.harvest(ripe)}>
              {ripe.length ? `HARVEST ${ripe.length} RIPE` : 'NOTHING RIPE YET'}
            </button>
          </div>
        </section>
        <section className="panel garden-panel" aria-label="Your Garden">
          <div className="label">YOUR GARDEN</div>
          <div className="garden-stats mono small">
            <span>
              <span className="coin" aria-hidden="true" /> {fmtAura(g.gold)} $gold
            </span>
            <span>
              {16 - empty.length}/16 planted · {ripe.length} ripe
            </span>
            {growing.length > 0 && <span className="muted">next ripe in {timeLeft(nextRipe - g.now)}</span>}
          </div>
          <div className="label">HARVEST</div>
          {items.length ? (
            <ul className="harvest-list">
              {items.map(([id, qty]) => {
                const c = CROPS[id as CropId];
                return (
                  <li key={id}>
                    {c && <span className="seed-icon small" style={{ backgroundImage: `url(${c.sprite})`, backgroundSize: `${c.stages * 100}% 100%`, backgroundPositionX: '100%' }} aria-hidden="true" />}
                    <span>{c?.name ?? id}</span> <span className="mono gold">× {fmtAura(qty)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="small muted">Nothing yet. Ripe plants go here when you harvest them.</div>
          )}
          {g.lastHarvest && (
            <div className="notice ok" role="status">
              Harvested {Object.entries(g.lastHarvest).map(([id, n]) => `${n} ${CROPS[id as CropId]?.name ?? id}`).join(', ')}.
            </div>
          )}
          <div className="small muted">Crops will sell for $gold and on the Marketplace later.</div>
        </section>
      </div>
    </div>
  );
}
