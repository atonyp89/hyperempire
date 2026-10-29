// The Garden screen: a 4x4 field where seeds from the inventory (bought with $gold) grow on the clock and are
// harvested back into it. One crop (wheat) for now; more come later.

import { useState, type ReactNode } from 'react';
import { CROPS, cropOfSeed, GARDEN_PLOTS, growTime, type CropId } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { useGarden, type Garden } from '../hooks/useGarden';
import { itemInfo } from '../lib/items';
import { Inventory, type Stack } from '../ui/Inventory';
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

const CROP_LIST = Object.values(CROPS);

/** Seeds first, then everything else, each by name. */
const order = (a: Stack, b: Stack) => Number(!cropOfSeed(a.id)) - Number(!cropOfSeed(b.id)) || itemInfo(a.id).name.localeCompare(itemInfo(b.id).name);

function Field({ g }: { g: Garden }) {
  const stacks = Object.entries(g.inventory)
    .map(([id, qty]) => ({ id, qty }))
    .sort(order);
  const seeds = stacks.filter((s) => cropOfSeed(s.id));
  const [pickedId, setPicked] = useState<string | null>(null);
  // The picked seed, or the first one held when the pick runs out.
  const picked = seeds.find((s) => s.id === pickedId) ?? seeds[0] ?? null;
  const crop = picked ? CROPS[cropOfSeed(picked.id) as CropId] : null;

  const empty = g.plots.filter((p) => !p.crop).map((p) => p.slot);
  const ripe = g.plots.filter((p) => p.ripe).map((p) => p.slot);
  const growing = g.plots.filter((p) => p.crop && !p.ripe);
  const nextRipe = growing.reduce((m, p) => Math.min(m, p.readyAt ?? Infinity), Infinity);
  const plantable = Math.min(empty.length, picked?.qty ?? 0);

  return (
    <div className="garden-grid">
      <GardenField
        plots={g.plots}
        now={g.now}
        seedName={crop ? crop.seedName : null}
        onPlant={(slot) => crop && g.plant(crop.id, [slot])}
        onHarvest={(slot) => g.harvest([slot])}
        pops={g.pops}
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
            <button type="button" className="btn primary" disabled={!crop || plantable === 0} onClick={() => crop && g.plant(crop.id, empty.slice(0, plantable))}>
              {empty.length === 0 ? 'ALL PLANTED' : !crop ? 'NO SEEDS' : `PLANT ${plantable} ${crop.name.toUpperCase()}`}
            </button>
            <button type="button" className="btn" disabled={ripe.length === 0} onClick={() => g.harvest(ripe)}>
              {ripe.length ? `HARVEST ${ripe.length}` : 'NOTHING RIPE'}
            </button>
          </div>
          <div className="small muted">
            {crop ? (
              <>
                Planting <span className="strong">{crop.name}</span>: ripe in {timeLeft(growTime(crop, g.speed))}, {crop.yield} per plant. Click an empty plot to plant, a ripe one to
                harvest.
              </>
            ) : (
              'Buy seeds below, then click an empty plot to plant them.'
            )}
          </div>
        </section>

        <section className="panel garden-panel" aria-label="Inventory">
          <div className="garden-head">
            <span className="label">INVENTORY</span>
          </div>
          <Inventory stacks={stacks} label="Your items" picked={picked?.id ?? null} canPick={(id) => !!cropOfSeed(id)} onPick={setPicked} />
          <div className="seed-shop">
            {CROP_LIST.map((c) =>
              [1, 10].map((n) => (
                <button key={`${c.id}-${n}`} type="button" className="btn" disabled={g.gold < c.seedGold * n} onClick={() => g.buy(c.id, n)}>
                  BUY {n} {c.seedName.toUpperCase()}{n > 1 ? 'S' : ''} · <span className="coin" aria-hidden="true" /> {fmtAura(c.seedGold * n)}
                </button>
              )),
            )}
          </div>
          <div className="small muted">Click a seed to plant it. Crops will sell for $gold and on the Marketplace later.</div>
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
