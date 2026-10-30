// The Garden screen: a 4x4 field where seeds from the inventory grow on the clock and are harvested back into it.
// Seeds come in packs bought with $gold; a pack opens into 10 seeds of random grades, and better seeds yield more.

import { useState } from 'react';
import { CROPS, cropPrice, GRADES, growTime, sellGold, PACK_SEEDS, packGold, packItem, SEED_YIELD, yieldOf, type CropId } from '@server/contract';
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
  const [sellId, setSellId] = useState<string | null>(null);
  const [shop, setShop] = useState(false);
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<'seeds' | 'harvest'>('seeds');
  // Seeds tab: packs and seeds; Harvest tab: everything else (crops).
  const isSeedTab = (id: string) => ['pack', 'seed'].includes(itemInfo(id).kind);
  const shown = stacks.filter((x) => isSeedTab(x.id) === (tab === 'seeds'));
  const count = (seedTab: boolean) => stacks.filter((x) => isSeedTab(x.id) === seedTab).reduce((n, x) => n + x.qty, 0);
  const f = useFarmers();
  // The seed the player selected in the inventory, while they still hold one.
  const picked = seeds.find((s) => s.id === pickedId) ?? null;
  const seed = picked ? itemInfo(picked.id) : null;
  const crop = seed?.crop ? CROPS[seed.crop] : null;
  const empty = g.plots.filter((p) => !p.crop).map((p) => p.slot);
  // The crop selected for selling, while some is held.
  const selling = stacks.find((x) => x.id === sellId && itemInfo(x.id).kind === 'crop') ?? null;
  /** How many of the selected seed fit: one per empty plot. */
  const fits = Math.min(empty.length, picked?.qty ?? 0);

  const use = (id: string) => {
    const info = itemInfo(id);
    if (info.kind === 'pack' && info.crop) g.open(info.crop);
    // Clicking the selected seed again deselects it.
    else if (info.kind === 'seed') setPicked((cur) => (cur === id ? null : id));
    else if (info.kind === 'crop') setSellId((cur) => (cur === id ? null : id));
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
        farmers={g.farmers}
      />
      <div className="garden-side">
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
          <div className="inv-tabs" role="tablist" aria-label="Inventory">
            {(['seeds', 'harvest'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`ex-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                {t === 'seeds' ? 'SEEDS' : 'HARVEST'} · {fmtAura(count(t === 'seeds'))}
              </button>
            ))}
          </div>
          <Inventory
            stacks={shown}
            label="Your items"
            picked={(tab === 'seeds' ? picked?.id : selling?.id) ?? null}
            actionOf={(id) => ({ pack: 'open', seed: 'pick', crop: 'sell' } as Record<string, string>)[itemInfo(id).kind] ?? null}
            onPick={use}
          />
          {tab === 'seeds' && picked && seed && crop && seed.grade && (
            <div className={`seed-bar grade-${seed.grade}`}>
              <span className="seed-bar-icon inv-icon" style={seed.icon} aria-hidden="true" />
              <span className="seed-bar-text">
                <span className={`strong grade-text-${seed.grade}`}>
                  {seed.name} × {picked.qty}
                </span>
                <span className="small muted">
                  Ripe in {timeLeft(growTime(crop, g.speed) * (1 - g.bonus.growthPct / 100))} · {Math.round(yieldOf(crop, seed.grade) * (1 + g.bonus.yieldPct / 100))} per plant
                </span>
              </span>
              {fits === 0 ? (
                <span className="small muted">No empty plots</span>
              ) : (
                <span className="seed-bar-actions">
                  <button type="button" className="btn primary" onClick={() => g.plant(picked.id, empty.slice(0, 1))}>
                    PLANT 1
                  </button>
                  {fits >= 2 && (
                    <button type="button" className="btn primary" onClick={() => g.plant(picked.id, empty.slice(0, fits))}>
                      PLANT {fits}
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
          {tab === 'harvest' && selling && <SellBar g={g} item={selling.id} qty={selling.qty} />}
          {tab === 'seeds' && (
            <button type="button" className="btn shop-open" onClick={() => setShop(true)}>
              <span className="shop-icon" style={itemInfo(packItem('wheat')).icon} aria-hidden="true" />
              BUY SEED PACK
            </button>
          )}
          <div className="small muted">
            {tab === 'seeds' ? (
              <>
                Select a seed to plant it, then use the buttons or click an empty plot; click a ripe plant to harvest. Better seeds yield more: ×
                {SEED_YIELD.uncommon} uncommon up to ×{SEED_YIELD.legendary} legendary.
              </>
            ) : (
              'What you harvest lands here. Select a crop to sell it to the NPC for $gold; the Marketplace comes later.'
            )}
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

/** Sell a harvested crop to the NPC: its price each, and what 10 or all of them pay (whole $gold, rounded down). */
function SellBar({ g, item, qty }: { g: Garden; item: string; qty: number }) {
  const info = itemInfo(item);
  const crop = info.crop ? CROPS[info.crop] : null;
  if (!crop) return null;
  const sold = g.lastSale?.item === item ? g.lastSale : null;
  return (
    <div className="seed-bar">
      <span className="seed-bar-icon inv-icon" style={info.icon} aria-hidden="true" />
      <span className="seed-bar-text">
        <span className="strong">
          {info.name} × {fmtAura(qty)}
        </span>
        <span className="small muted">
          {sold ? (
            <span className="gold">
              Sold {fmtAura(sold.qty)} for {fmtAura(sold.gold)} $gold
            </span>
          ) : (
            <>
              <span className="coin" aria-hidden="true" /> {cropPrice(crop).toFixed(2)} $gold each
            </>
          )}
        </span>
      </span>
      <span className="seed-bar-actions">
        {qty > 10 && (
          <button type="button" className="btn primary" onClick={() => g.sell(item, 10)}>
            SELL 10 · {sellGold(crop, 10)}
          </button>
        )}
        <button type="button" className="btn primary" onClick={() => g.sell(item, qty)}>
          SELL ALL · {fmtAura(sellGold(crop, qty))}
        </button>
      </span>
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
