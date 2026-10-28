import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BUILDER_ADDRESS, BUILDER_FEE_RATE, BUILDER_MAX_FEE_RATE, MARKET_SLIPPAGE } from '../config';
import { useBuilderFee } from '../rewards';
import type { Market } from '../hooks/useMarkets';
import type { useOnboarding } from '../hooks/useOnboarding';
import { useActiveAsset, useBook, useClearinghouse, useUserFees } from '../hooks/useTraderData';
import { errorMessage } from '../lib/hl';
import { useTradingRewards } from '../rewards';
import { fmtAura, fmtNum, fmtPx, fmtUsd } from '../../shared/format';
import { formatPrice, formatSize } from '../lib/prices';
import { estLiquidationPx, estSlippage, priceForRoe, roeForPrice } from '../lib/orderMath';
import { placeOrder, setLeverage, triggerOids } from '../lib/orders';

type Onboarding = ReturnType<typeof useOnboarding>;
/** A price picked from a market's order book; `n` changes on every pick so picking the same price again still applies. */
export type BookPick = { coin: string; px: number; n: number };
type Props = { market?: Market; user?: `0x${string}`; onboarding: Onboarding; pick?: BookPick | null };

/**
 * Dev only: `?order-preview` shows the order form without a wallet, reading the zero address's (empty)
 * account, so the layout can be checked in a browser. It can't send anything: there's no trading key.
 */
const PREVIEW_USER = import.meta.env.DEV && new URLSearchParams(window.location.search).has('order-preview')
  ? ('0x0000000000000000000000000000000000000000' as const)
  : null;

export function OrderPanel({ market, user, onboarding, pick }: Props) {
  if (PREVIEW_USER && market) return <OrderForm key={market.name} market={market} user={PREVIEW_USER} onboarding={onboarding} pick={pick} />;
  if (!BUILDER_ADDRESS) {
    return (
      <div className="notice warn">
        <b>Builder address missing.</b> Set <code>VITE_BUILDER_ADDRESS</code> in <code>.env.local</code> to enable trading.
      </div>
    );
  }
  if (!user) return <div className="notice">Connect a wallet to trade and start earning $aura.</div>;
  if (onboarding.loading) return <div className="muted pad">Checking your account…</div>;
  if (!onboarding.ready) return <Onboarding onboarding={onboarding} />;
  if (!market) return <div className="muted pad">Loading market…</div>;
  return <OrderForm key={market.name} market={market} user={user} onboarding={onboarding} pick={pick} />;
}

function Onboarding({ onboarding: o }: { onboarding: Onboarding }) {
  const rewards = useTradingRewards();
  return (
    <div className="onboarding">
      <div className="label">SET UP TRADING · ONE TIME</div>
      <Step
        n={1}
        done={o.builderApproved}
        title="Approve the HyperEmpire builder fee"
        body={`Lets HyperEmpire add its fee to your orders, up to ${BUILDER_MAX_FEE_RATE}. ${rewards.howItWorks}`}
        action={o.approveBuilder}
        busy={o.busy === 'builder'}
        disabled={!o.canSign}
        cta="APPROVE FEE"
      />
      <Step
        n={2}
        done={o.agentApproved}
        title="Enable trading"
        body="Creates a trading key in this browser and approves it on Hyperliquid. It can place orders but can never withdraw."
        action={o.enableTrading}
        busy={o.busy === 'agent'}
        disabled={!o.canSign || !o.builderApproved}
        cta="ENABLE TRADING"
      />
      {o.error && <div className="notice err">{o.error}</div>}
      <p className="muted small">
        Both steps are signatures, not transactions, so they cost no gas. Your account needs a USDC deposit on Hyperliquid first.
      </p>
    </div>
  );
}

type StepProps = { n: number; done: boolean; title: string; body: string; action: () => void; busy: boolean; disabled: boolean; cta: string };

function Step({ n, done, title, body, action, busy, disabled, cta }: StepProps) {
  return (
    <div className={`step ${done ? 'done' : ''}`}>
      <div className="step-n">{done ? '✓' : n}</div>
      <div className="step-body">
        <div className="strong">{title}</div>
        <div className="muted small">{body}</div>
        {!done && (
          <button type="button" className="btn primary" onClick={action} disabled={disabled || busy}>
            {busy ? 'CHECK YOUR WALLET…' : cta}
          </button>
        )}
      </div>
    </div>
  );
}

type Kind = 'market' | 'limit';
type Tif = 'Gtc' | 'Ioc' | 'Alo';
type Dialog = 'leverage' | 'margin' | null;

/** Hyperliquid's base-tier rates, used until the account's own rates load. */
const DEFAULT_FEES = { taker: 0.00045, maker: 0.00015 };
const TIFS: { id: Tif; label: string; hint: string }[] = [
  { id: 'Gtc', label: 'GTC', hint: 'Good till cancelled: rests on the book until filled or cancelled' },
  { id: 'Ioc', label: 'IOC', hint: 'Immediate or cancel: fills what it can now, cancels the rest' },
  { id: 'Alo', label: 'ALO', hint: 'Add liquidity only: cancelled instead of filling right away (post only)' },
];
const PCT_MARKS = [0, 25, 50, 75, 100];
const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);
const fmtRate = (r: number) => `${(r * 100).toFixed(4)}%`;

/**
 * The Long / Short order form, laid out like Hyperliquid's: margin mode and leverage, market or limit, side,
 * size in coin or USD with a slider of the max size, reduce only, time in force, TP/SL by price or by gain,
 * and a summary with liquidation, margin, slippage, fees and the $aura the order earns.
 */
function OrderForm({ market, user, onboarding, pick }: { market: Market; user: `0x${string}`; onboarding: Onboarding; pick?: BookPick | null }) {
  const qc = useQueryClient();
  const rewards = useTradingRewards();
  const builderFeeNow = useBuilderFee();
  const active = useActiveAsset(user, market.name);
  const ch = useClearinghouse(user);
  const fees = useUserFees(user).data ?? DEFAULT_FEES;
  const [kind, setKind] = useState<Kind>('market');
  const book = useBook(market.name, kind === 'market');
  const [isBuy, setIsBuy] = useState(true);
  const [unit, setUnit] = useState<'coin' | 'usd'>('usd');
  const [sizeIn, setSizeIn] = useState('');
  const [limitPx, setLimitPx] = useState('');
  const [tif, setTif] = useState<Tif>('Gtc');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [tp, setTp] = useState({ px: '', roe: '' });
  const [sl, setSl] = useState({ px: '', roe: '' });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // A price clicked in the order book becomes a limit order at that price.
  useEffect(() => {
    if (!pick || pick.coin !== market.name) return;
    setKind('limit');
    setLimitPx(formatPrice(pick.px, market.szDecimals));
  }, [pick?.n]);

  const lev = active.data?.leverage;
  const leverage = lev?.value ?? Math.min(10, market.maxLeverage);
  const isCross = lev ? lev.type === 'cross' : true;
  const px = kind === 'limit' && num(limitPx) > 0 ? num(limitPx) : market.midPx;
  const size = unit === 'coin' ? num(sizeIn) : px > 0 ? num(sizeIn) / px : 0;
  const notional = size * px;
  const margin = notional / leverage;
  const side = isBuy ? 0 : 1;
  const available = active.data ? Number(active.data.availableToTrade[side]) : null;
  const maxSz = active.data ? Number(active.data.maxTradeSzs[side]) : 0;
  const pct = maxSz > 0 ? Math.min(100, (size / maxSz) * 100) : 0;
  const position = ch.data?.assetPositions.find((p) => p.position.coin === market.name)?.position;
  const szi = position ? Number(position.szi) : 0;

  const liq = reduceOnly
    ? null
    : estLiquidationPx({ px, size, isLong: isBuy, leverage, maxLeverage: market.maxLeverage, isCross, freeUsd: (available ?? 0) - margin });
  const slip = kind === 'market' && book.data ? estSlippage(isBuy ? book.data.asks : book.data.bids, size, market.midPx) : null;
  const exchangeFee = notional * (kind === 'market' ? fees.taker : fees.maker);
  const builderFee = notional * builderFeeNow.rate;

  /** Show `coins` in the size box, in the current unit. */
  const showSize = (coins: number, inUnit = unit) =>
    setSizeIn(coins > 0 ? (inUnit === 'coin' ? formatSize(coins, market.szDecimals) : (coins * px).toFixed(2)) : '');
  const setPct = (p: number) => showSize((maxSz * p) / 100);
  const flipUnit = () => {
    const next = unit === 'coin' ? 'usd' : 'coin';
    setUnit(next);
    showSize(size, next);
  };

  const tpslFromPx = (kindOf: 'tp' | 'sl', v: string) =>
    (kindOf === 'tp' ? setTp : setSl)({ px: v, roe: num(v) > 0 ? roeForPrice(px, num(v), leverage).toFixed(2) : '' });
  const tpslFromRoe = (kindOf: 'tp' | 'sl', v: string) =>
    (kindOf === 'tp' ? setTp : setSl)({
      roe: v,
      px: num(v) > 0 ? formatPrice(priceForRoe(px, num(v), leverage, isBuy, kindOf), market.szDecimals) : '',
    });

  /** A take profit must sit on the winning side of the entry and a stop loss on the losing side. */
  function tpslProblem(): string | null {
    if (!tpsl) return null;
    const above = (v: string) => num(v) > px;
    if (num(tp.px) > 0 && above(tp.px) !== isBuy) return `Take profit must be ${isBuy ? 'above' : 'below'} ${fmtPx(px)} for a ${isBuy ? 'long' : 'short'}.`;
    if (num(sl.px) > 0 && above(sl.px) === isBuy) return `Stop loss must be ${isBuy ? 'below' : 'above'} ${fmtPx(px)} for a ${isBuy ? 'long' : 'short'}.`;
    return null;
  }

  async function submit() {
    const trader = onboarding.trader;
    if (!trader) return;
    const problem = tpslProblem();
    if (problem) return setResult({ ok: false, text: problem });
    setBusy(true);
    setResult(null);
    try {
      const placed = await placeOrder(trader, {
        market,
        isBuy,
        kind,
        tif,
        size,
        limitPx: kind === 'limit' ? px : undefined,
        reduceOnly,
        takeProfit: tpsl && num(tp.px) > 0 ? num(tp.px) : undefined,
        stopLoss: tpsl && num(sl.px) > 0 ? num(sl.px) : undefined,
        builderFeeTenths: builderFeeNow.tenths,
      });
      setResult({ ok: true, text: placed.text });
      // Report the orders (and any TP/SL, read back) so their fees earn $aura. Best effort: trading never waits on it.
      void (async () => {
        const extra = placed.hasTriggers ? await triggerOids(user, market.name).catch(() => []) : [];
        const oids = [...new Set([...placed.oids, ...extra])];
        if (oids.length) rewards.onOrders(oids);
      })();
      setSizeIn('');
      setTp({ px: '', roe: '' });
      setSl({ px: '', roe: '' });
      await qc.invalidateQueries({ predicate: (q) => ['clearinghouse', 'openOrders', 'fills', 'activeAsset'].includes(String(q.queryKey[0])) });
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="order-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="order-top">
        <button type="button" className="chip-btn" onClick={() => setDialog('margin')}>{isCross ? 'CROSS' : 'ISOLATED'}</button>
        <button type="button" className="chip-btn" onClick={() => setDialog('leverage')}>{leverage}x</button>
      </div>

      <div className="tabs-line" role="tablist" aria-label="Order type">
        {(['market', 'limit'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="seg" role="group" aria-label="Side">
        <button type="button" className={isBuy ? 'on long' : ''} aria-pressed={isBuy} onClick={() => setIsBuy(true)}>BUY / LONG</button>
        <button type="button" className={!isBuy ? 'on short' : ''} aria-pressed={!isBuy} onClick={() => setIsBuy(false)}>SELL / SHORT</button>
      </div>

      <dl className="kv">
        <div><dt>Available to trade</dt><dd className="mono">{available === null ? '—' : fmtUsd(available)}</dd></div>
        <div>
          <dt>Current position</dt>
          <dd className={`mono ${szi > 0 ? 'up' : szi < 0 ? 'down' : ''}`}>{fmtNum(szi, market.szDecimals)} {market.name}</dd>
        </div>
      </dl>

      {kind === 'limit' && (
        <div className="box-input">
          <span className="box-label">PRICE (USD)</span>
          <input className="mono" inputMode="decimal" aria-label="Limit price in USD" value={limitPx} placeholder={fmtPx(market.midPx)} onChange={(e) => setLimitPx(e.target.value)} />
          <button type="button" className="box-suffix link" onClick={() => setLimitPx(formatPrice(market.midPx, market.szDecimals))}>MID</button>
        </div>
      )}

      <div className="box-input">
        <span className="box-label">SIZE</span>
        <input className="mono" inputMode="decimal" aria-label={`Size in ${unit === 'coin' ? market.name : 'USD'}`} value={sizeIn} placeholder="0" onChange={(e) => setSizeIn(e.target.value)} />
        <button type="button" className="box-suffix" title="Switch the size unit" onClick={flipUnit}>{unit === 'coin' ? market.name : 'USD'} ⇄</button>
      </div>

      <div className="pct-row">
        <div className="pct-slider">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(pct)}
            aria-label="Size as a share of the max"
            style={{ '--pct': `${pct}%` } as React.CSSProperties}
            onChange={(e) => setPct(Number(e.target.value))}
          />
          <div className="pct-marks" aria-hidden="true">
            {PCT_MARKS.map((m) => (
              <button key={m} type="button" tabIndex={-1} className={pct >= m && size > 0 ? 'hit' : ''} style={{ left: `${m}%` }} onClick={() => setPct(m)} />
            ))}
          </div>
        </div>
        <div className="box-input pct-box">
          <input className="mono" inputMode="decimal" aria-label="Size in % of the max" value={size > 0 ? Math.round(pct) : ''} placeholder="0" onChange={(e) => setPct(Math.min(100, num(e.target.value)))} />
          <span className="box-suffix plain">%</span>
        </div>
      </div>

      <div className="opts">
        <label><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} /> Reduce only</label>
        {kind === 'limit' && (
          <label className="tif" title={TIFS.find((t) => t.id === tif)?.hint}>
            <span className="muted">TIF</span>
            <select value={tif} onChange={(e) => setTif(e.target.value as Tif)} aria-label="Time in force">
              {TIFS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="opts">
        <label><input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} /> Take profit / Stop loss</label>
      </div>
      {tpsl && (
        <div className="tpsl-grid">
          <div className="box-input">
            <span className="box-label">TP PRICE</span>
            <input className="mono" inputMode="decimal" aria-label="Take profit price" value={tp.px} placeholder="—" onChange={(e) => tpslFromPx('tp', e.target.value)} />
          </div>
          <div className="box-input">
            <span className="box-label">GAIN</span>
            <input className="mono" inputMode="decimal" aria-label="Take profit gain in %" value={tp.roe} placeholder="0" onChange={(e) => tpslFromRoe('tp', e.target.value)} />
            <span className="box-suffix plain">%</span>
          </div>
          <div className="box-input">
            <span className="box-label">SL PRICE</span>
            <input className="mono" inputMode="decimal" aria-label="Stop loss price" value={sl.px} placeholder="—" onChange={(e) => tpslFromPx('sl', e.target.value)} />
          </div>
          <div className="box-input">
            <span className="box-label">LOSS</span>
            <input className="mono" inputMode="decimal" aria-label="Stop loss in %" value={sl.roe} placeholder="0" onChange={(e) => tpslFromRoe('sl', e.target.value)} />
            <span className="box-suffix plain">%</span>
          </div>
          <p className="muted small tpsl-note">Gain and loss are on your margin at {leverage}x. Both close the whole order at market when hit.</p>
        </div>
      )}

      <button type="submit" className={`btn big ${isBuy ? 'long' : 'short'}`} disabled={busy || size <= 0 || !onboarding.trader}>
        {busy ? 'SENDING…' : `${isBuy ? 'LONG' : 'SHORT'} ${market.name}`}
      </button>
      {result && <div className={`notice ${result.ok ? 'ok' : 'err'}`}>{result.text}</div>}

      <dl className="kv summary-kv">
        <div><dt title="Estimate for this order alone; the real price depends on your whole account">Est. liquidation price</dt><dd className="mono">{liq ? fmtPx(liq) : '—'}</dd></div>
        <div><dt>Order value</dt><dd className="mono">{notional > 0 ? fmtUsd(notional) : '—'}</dd></div>
        <div><dt>Margin required</dt><dd className="mono">{notional > 0 ? fmtUsd(margin) : '—'}</dd></div>
        {kind === 'market' && (
          <div>
            <dt>Slippage</dt>
            <dd className="mono">Est {slip ? `${slip.pct.toFixed(3)}%` : size > 0 && book.data ? '> book' : '0%'} / Max {(MARKET_SLIPPAGE * 100).toFixed(0)}%</dd>
          </div>
        )}
        <div title={`Hyperliquid taker ${fmtRate(fees.taker)} / maker ${fmtRate(fees.maker)}, plus the HyperEmpire builder fee`}>
          <dt>Fees</dt>
          <dd className="mono">
            {fmtRate(fees.taker)} / {fmtRate(fees.maker)} + {fmtRate(builderFeeNow.rate)}
            {builderFeeNow.rate < BUILDER_FEE_RATE && <span className="muted"> (−{Math.round((1 - builderFeeNow.rate / BUILDER_FEE_RATE) * 100)}% Mastery)</span>}
          </dd>
        </div>
        {notional > 0 && <div><dt>Est. fees on this order</dt><dd className="mono">{fmtUsd(exchangeFee + builderFee, 4)}</dd></div>}
        <AuraLine fee={notional * BUILDER_FEE_RATE} />
      </dl>

      {dialog === 'leverage' && (
        <LeverageDialog
          market={market}
          current={leverage}
          onClose={() => setDialog(null)}
          onApply={async (v) => {
            if (!onboarding.trader) throw new Error('Enable trading first.');
            await setLeverage(onboarding.trader, market.asset, v, isCross);
            await qc.invalidateQueries({ queryKey: ['activeAsset'] });
          }}
        />
      )}
      {dialog === 'margin' && (
        <MarginDialog
          market={market}
          isCross={isCross}
          onClose={() => setDialog(null)}
          onApply={async (cross) => {
            if (!onboarding.trader) throw new Error('Enable trading first.');
            await setLeverage(onboarding.trader, market.asset, leverage, cross);
            await qc.invalidateQueries({ queryKey: ['activeAsset'] });
          }}
        />
      )}
    </form>
  );
}

/** Small dialog over the order form, with its own apply step and error line. */
function MiniDialog({ title, children, onClose, onApply, applyLabel }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onApply: () => Promise<void>;
  applyLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mini-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mini-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mini-dialog-head">
          <span className="title-pixel">{title}</span>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>✕</button>
        </div>
        {children}
        {err && <div className="notice err">{err}</div>}
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onApply();
              onClose();
            } catch (e) {
              setErr(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'CONFIRMING…' : applyLabel}
        </button>
      </div>
    </div>
  );
}

function LeverageDialog({ market, current, onClose, onApply }: { market: Market; current: number; onClose: () => void; onApply: (v: number) => Promise<void> }) {
  const [v, setV] = useState(current);
  const clampLev = (n: number) => Math.max(1, Math.min(market.maxLeverage, Math.round(n) || 1));
  return (
    <MiniDialog title="ADJUST LEVERAGE" onClose={onClose} onApply={() => onApply(v)} applyLabel="CONFIRM">
      <p className="muted small">Leverage for {market.name} positions. The maximum is {market.maxLeverage}x.</p>
      <div className="pct-row">
        <input type="range" min={1} max={market.maxLeverage} value={v} aria-label="Leverage" onChange={(e) => setV(Number(e.target.value))} className="lev-range" />
        <div className="box-input pct-box">
          <input className="mono" inputMode="numeric" aria-label="Leverage value" value={v} onChange={(e) => setV(clampLev(Number(e.target.value)))} />
          <span className="box-suffix plain">x</span>
        </div>
      </div>
      <div className="notice warn small">Higher leverage brings the liquidation price closer.</div>
    </MiniDialog>
  );
}

function MarginDialog({ market, isCross, onClose, onApply }: { market: Market; isCross: boolean; onClose: () => void; onApply: (cross: boolean) => Promise<void> }) {
  const [cross, setCross] = useState(isCross);
  const options = [
    { id: true, label: 'CROSS', body: 'All cross positions share your account balance as margin. A loss on one draws on the rest, but liquidation is further away.' },
    { id: false, label: 'ISOLATED', body: 'Only the margin you put in this position is at risk. It can be liquidated sooner, but other positions are untouched.' },
  ];
  return (
    <MiniDialog title={`${market.name} MARGIN MODE`} onClose={onClose} onApply={() => onApply(cross)} applyLabel="CONFIRM">
      <div className="mode-list" role="radiogroup" aria-label="Margin mode">
        {options.map((o) => (
          <button key={o.label} type="button" role="radio" aria-checked={cross === o.id} className={`mode-opt ${cross === o.id ? 'on' : ''}`} onClick={() => setCross(o.id)}>
            <span className="strong">{o.label}</span>
            <span className="muted small">{o.body}</span>
          </button>
        ))}
      </div>
      <p className="muted small">The mode can't change while you have an open {market.name} position.</p>
    </MiniDialog>
  );
}

/** The $aura this order's builder fee would add to the player's share of today's pool. */
function AuraLine({ fee }: { fee: number }) {
  const rewards = useTradingRewards();
  const aura = fee > 0 ? rewards.auraForFee(fee) : 0;
  return (
    <div className="aura-line" title={rewards.howItWorks}>
      <dt>$aura from this order</dt>
      <dd className="mono">{aura === null ? 'sign in to earn' : fee > 0 ? `≈ +${fmtAura(aura)}` : '—'}</dd>
    </div>
  );
}
