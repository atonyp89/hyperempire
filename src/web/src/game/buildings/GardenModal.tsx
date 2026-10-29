// The Garden screen: a 4x4 field where seeds bought with $gold grow on the clock and are harvested into the
// inventory. One crop (wheat) for now; more come later.

import { useState, type ReactNode } from 'react';
import { CROPS, GARDEN_PLOTS, growTime, type CropId } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { useGarden, type Garden } from '../hooks/useGarden';
import { itemInfo } from '../lib/items';
import { Inventory, ItemSlot } from '../ui/Inventory';
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
  const stacks = Object.entries(g.inventory).map(([id, qty]) => ({ id, qty }));

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
        <section className="panel garden-panel" aria-label="Field">
          <div className="garden-head">
            <span className="label">FIELD</span>
            {g.speed > 1 && (
              <span className="dev-badge" title={`Development: crops grow ${g.speed}× faster`}>
                DEV ×{g.speed}
              </span>
            )}
          </div>
          <div className="garden-stats">
            <Stat label="$GOLD" value={<><span className="coin" aria-hidden="true" /> {fmtAura(g.gold)}</>} />
            <Stat label="PLANTED" value={`${GARDEN_PLOTS - empty.length}/${GARDEN_PLOTS}`} />
            <Stat label="RIPE" value={String(ripe.length)} />
            <Stat label="NEXT" value={growing.length ? timeLeft(nextRipe - g.now) : '—'} />
          </div>
          <div className="garden-actions">
            <button type="button" className="btn primary" disabled={g.busy || affordable === 0} onClick={() => g.plant(seed, empty.slice(0, affordable))}>
              {empty.length === 0 ? 'ALL PLANTED' : affordable === 0 ? 'NO $GOLD' : `PLANT ${affordable} · ${fmtAura(affordable * crop.seedGold)}`}
            </button>
            <button type="button" className="btn" disabled={g.busy || ripe.length === 0} onClick={() => g.harvest(ripe)}>
              {ripe.length ? `HARVEST ${ripe.length}` : 'NOTHING RIPE'}
            </button>
          </div>
        </section>

        <section className="panel garden-panel" aria-label="Seeds">
          <span className="label">SEEDS</span>
          <div className="seed-row" role="radiogroup" aria-label="Seed to plant">
            {SEEDS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === seed} className="seed-pick" onClick={() => setSeed(c.id)}>
                <ItemSlot icon={itemInfo(c.id).icon} title={`${c.name} seed: ${c.seedGold} $gold`} className={c.id === seed ? 'on' : ''}>
                  <span className="inv-price">
                    <span className="coin" aria-hidden="true" />
                    {c.seedGold}
                  </span>
                </ItemSlot>
              </button>
            ))}
          </div>
          <div className="small muted">
            <span className="strong">{crop.name}</span> · ripe in {timeLeft(growTime(crop, g.speed))} · {crop.yield} per plant. Click an empty plot to plant, a ripe one to harvest.
          </div>
        </section>

        <section className="panel garden-panel" aria-label="Inventory">
          <div className="garden-head">
            <span className="label">INVENTORY</span>
            {g.lastHarvest && (
              <span key={JSON.stringify(g.lastHarvest)} className="harvest-toast" role="status">
                +{Object.entries(g.lastHarvest).map(([id, n]) => `${n} ${itemInfo(id).name}`).join(', ')}
              </span>
            )}
          </div>
          <Inventory stacks={stacks} label="Your items" />
          <div className="small muted">Crops will sell for $gold and on the Marketplace later.</div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="garden-stat">
      <span className="label">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
