// The Garden screen: a 4x4 field where seeds from the inventory grow on the clock and are harvested back into it.
// Seeds come in packs bought with $gold; a pack opens into 10 seeds of random grades, and better seeds yield more.

import { useState, type ReactNode } from 'react';
import { CROPS, GARDEN_PLOTS, GRADES, growTime, PACK_SEEDS, packGold, packItem, SEED_YIELD, yieldOf, type CropId } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { useGarden, type Garden } from '../hooks/useGarden';
import { itemInfo } from '../lib/items';
import { Inventory, type Stack } from '../ui/Inventory';
import { Overlay } from '../ui/Overlay';
import { useFarmers } from '../hooks/useFarmers';
import { farmerName, farmerPerks, farmerPortrait } from '../lib/farmers';
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

/** Packs first, then seeds (best grade first), then crops; within a kind, by crop name. */
const KIND_ORDER = { pack: 0, seed: 1, crop: 2, other: 3 } as const;
function order(a: Stack, b: Stack) {
  const [x, y] = [itemInfo(a.id), itemInfo(b.id)];
  return (
    KIND_ORDER[x.kind] - KIND_ORDER[y.kind] ||
    (x.crop ?? '').localeCompare(y.crop ?? '') ||
    GRADES.indexOf(y.grade ?? 'common') - GRADES.indexOf(x.grade ?? 'common')
  );
}

function Field({ g }: { g: Garden }) {
  const stacks = Object.entries(g.inventory)
    .map(([id, qty]) => ({ id, qty }))
    .sort(order);
  const seeds = stacks.filter((s) => itemInfo(s.id).kind === 'seed');
  const [pickedId, setPicked] = useState<string | null>(null);
  const [shop, setShop] = useState(false);
  const [picking, setPicking] = useState(false);
  const f = useFarmers();
  // The picked seed, or the first (best) one held when the pick runs out.
  const picked = seeds.find((s) => s.id === pickedId) ?? seeds[0] ?? null;
  const seed = picked ? itemInfo(picked.id) : null;
  const crop = seed?.crop ? CROPS[seed.crop] : null;

  const empty = g.plots.filter((p) => !p.crop).map((p) => p.slot);
  const ripe = g.plots.filter((p) => p.ripe).map((p) => p.slot);
  const growing = g.plots.filter((p) => p.crop && !p.ripe);
  const nextRipe = growing.reduce((m, p) => Math.min(m, p.readyAt ?? Infinity), Infinity);
  const plantable = Math.min(empty.length, picked?.qty ?? 0);

  const use = (id: string) => {
    const info = itemInfo(id);
    if (info.kind === 'pack' && info.crop) g.open(info.crop);
    else if (info.kind === 'seed') setPicked(id);
  };

  return (
    <div className="garden-grid">
      <GardenField
        plots={g.plots}
        now={g.now}
        seedName={seed ? seed.name : null}
        onPlant={(slot) => picked && g.plant(picked.id, [slot])}
        onHarvest={(slot) => g.harvest([slot])}
        pops={g.pops}
        heroActive={!shop && !g.opened && !picking}
        farmers={g.farmers}
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
            <button type="button" className="btn primary" disabled={!picked || plantable === 0} onClick={() => picked && g.plant(picked.id, empty.slice(0, plantable))}>
              {empty.length === 0 ? 'ALL PLANTED' : !crop ? 'NO SEEDS' : `PLANT ${plantable} ${crop.name.toUpperCase()}`}
            </button>
            <button type="button" className="btn" disabled={ripe.length === 0} onClick={() => g.harvest(ripe)}>
              {ripe.length ? `HARVEST ${ripe.length}` : 'NOTHING RIPE'}
            </button>
          </div>
          <div className="small muted">
            {crop && seed?.grade ? (
              <>
                Planting <span className={`strong grade-text-${seed.grade}`}>{seed.name}</span>: ripe in {timeLeft(growTime(crop, g.speed))}, {yieldOf(crop, seed.grade)} per
                plant. Click an empty plot to plant, a ripe one to harvest.
              </>
            ) : (
              'Buy a seed pack below, then click an empty plot to plant its seeds.'
            )}
          </div>
        </section>

        <section className="panel garden-panel" aria-label="Farmers">
          <div className="garden-head">
            <span className="label">
              FARMERS · {f.working.length}/{f.slots}
            </span>
            {(g.bonus.yieldPct > 0 || g.bonus.growthPct > 0) && <span className="small mono gold">{farmerPerks(g.bonus)}</span>}
          </div>
          <div className="farmer-slots">
            {Array.from({ length: f.slots }, (_, i) => {
              const x = f.working[i];
              return x ? (
                <div key={x.id} className={`farmer-slot grade-${x.grade}`} title={`${farmerName(x)}: ${farmerPerks(x)}`}>
                  <span className="farmer-portrait inv-icon" style={farmerPortrait} aria-hidden="true" />
                  <span className="farmer-slot-text">
                    <span className={`strong small grade-text-${x.grade}`}>{farmerName(x)}</span>
                    <span className="small mono">{farmerPerks(x)}</span>
                  </span>
                  <button type="button" className="pack-close" onClick={() => f.assign(x.id, false)} aria-label={`Send ${farmerName(x)} to rest`}>
                    ✕
                  </button>
                </div>
              ) : (
                <button key={`empty-${i}`} type="button" className="farmer-slot empty" onClick={() => setPicking(true)}>
                  + ADD A FARMER
                </button>
              );
            })}
          </div>
          <div className="small muted">Their growth cut applies to what you plant while they work; the yield bonus applies at harvest.</div>
        </section>

        <section className="panel garden-panel" aria-label="Inventory">
          <div className="garden-head">
            <span className="label">INVENTORY</span>
          </div>
          <Inventory
            stacks={stacks}
            label="Your items"
            picked={picked?.id ?? null}
            actionOf={(id) => ({ pack: 'open', seed: 'pick' } as Record<string, string>)[itemInfo(id).kind] ?? null}
            onPick={use}
          />
          <button type="button" className="btn shop-open" onClick={() => setShop(true)}>
            <span className="shop-icon" style={itemInfo(packItem('wheat')).icon} aria-hidden="true" />
            BUY SEED PACK
          </button>
          <div className="small muted">
            Click a seed to plant it. Better seeds yield more: ×{SEED_YIELD.uncommon} uncommon up to ×{SEED_YIELD.legendary} legendary.
          </div>
        </section>
      </div>
      {shop && (
        <SeedShop
          gold={g.gold}
          speed={g.speed}
          onBuy={(crop) => {
            setShop(false);
            g.buyAndOpen(crop);
          }}
          onClose={() => setShop(false)}
        />
      )}
      {g.opened && <Opened ids={g.opened} onClose={g.dismissOpened} />}
      {picking && (
        <Overlay label="Choose a Farmer" onClose={() => setPicking(false)} className="seed-shop-dialog">
          <div className="garden-head">
            <span className="label">CHOOSE A FARMER</span>
            <button type="button" className="pack-close" onClick={() => setPicking(false)} aria-label="Close">
              ✕
            </button>
          </div>
          {f.farmers.some((x) => !x.assigned) ? (
            <div className="farmer-roster">
              {f.farmers
                .filter((x) => !x.assigned)
                .map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={`farmer-card grade-${x.grade}`}
                    onClick={() => {
                      f.assign(x.id, true);
                      setPicking(false);
                    }}
                  >
                    <span className="farmer-portrait inv-icon" style={farmerPortrait} aria-hidden="true" />
                    <span className={`strong grade-text-${x.grade}`}>{farmerName(x)}</span>
                    <span className="small mono">{farmerPerks(x)}</span>
                  </button>
                ))}
            </div>
          ) : (
            <div className="small muted">No resting Farmers. Recruit them at the Tavern in town.</div>
          )}
        </Overlay>
      )}
    </div>
  );
}

/** Every seed pack on sale: icon, what it holds, price and a Buy button. Buying opens the pack straight away. */
function SeedShop({ gold, speed, onBuy, onClose }: { gold: number; speed: number; onBuy: (crop: CropId) => void; onClose: () => void }) {
  return (
    <Overlay label="Seed packs" onClose={onClose} className="seed-shop-dialog">
      <div className="garden-head">
        <span className="label">SEED PACKS</span>
        <button type="button" className="pack-close" onClick={onClose} aria-label="Close the seed shop">
          ✕
        </button>
      </div>
      <div className="pack-grid">
        {CROP_LIST.map((c) => {
          const price = packGold(c);
          return (
            <div key={c.id} className="pack-card">
              <span className="pack-card-icon" style={itemInfo(packItem(c.id)).icon} aria-hidden="true" />
              <span className="strong">{c.packName}</span>
              <span className="muted small">
                {PACK_SEEDS} seeds · ripe in {timeLeft(growTime(c, speed))} · {c.yield}+ per plant
              </span>
              <button type="button" className="btn primary" disabled={gold < price} onClick={() => onBuy(c.id)}>
                BUY · <span className="coin" aria-hidden="true" /> {fmtAura(price)}
              </button>
            </div>
          );
        })}
      </div>
      <div className="small muted">
        Each seed rolls its grade: common 70%, uncommon 22%, rare 6.5%, epic 1.4%, legendary 0.1%. Better seeds yield more (×{SEED_YIELD.uncommon} up to ×{SEED_YIELD.legendary}).
      </div>
    </Overlay>
  );
}

/** The seeds a pack just gave, popping in one by one. A click anywhere closes it. */
function Opened({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const best = ids.map((id) => itemInfo(id)).reduce((b, i) => (GRADES.indexOf(i.grade ?? 'common') > GRADES.indexOf(b.grade ?? 'common') ? i : b));
  return (
    <Overlay label="Pack opened" onClose={onClose} closeOnClick className="pack-opened">
      <span className="label">PACK OPENED</span>
      <div className="pack-seeds" role="status" aria-label={ids.map((id) => itemInfo(id).name).join(', ')}>
        {ids.map((id, i) => {
          const info = itemInfo(id);
          return (
            <span key={i} className={`inv-slot pack-seed grade-${info.grade}`} style={{ animationDelay: `${i * 90}ms` }} title={info.name}>
              <span className="inv-icon" style={info.icon} aria-hidden="true" />
            </span>
          );
        })}
      </div>
      <div className="pack-best" style={{ animationDelay: `${ids.length * 90 + 150}ms` }}>
        Best: <span className={`strong grade-text-${best.grade}`}>{best.name}</span>
      </div>
      <div className="small muted">Click anywhere to close</div>
    </Overlay>
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
