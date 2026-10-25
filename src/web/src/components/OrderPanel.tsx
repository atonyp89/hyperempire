import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BUILDER_ADDRESS, BUILDER_FEE_RATE, BUILDER_MAX_FEE_RATE } from '../config';
import type { Market } from '../hooks/useMarkets';
import type { useOnboarding } from '../hooks/useOnboarding';
import { useActiveAsset } from '../hooks/useTraderData';
import { errorMessage } from '../lib/hl';
import { auraForNotional, fmtAura, fmtNum, fmtPx, fmtUsd } from '../lib/format';
import { placeOrder, setLeverage } from '../lib/orders';

type Onboarding = ReturnType<typeof useOnboarding>;
type Props = { market?: Market; user?: `0x${string}`; onboarding: Onboarding };

export function OrderPanel({ market, user, onboarding }: Props) {
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
  return <OrderForm key={market.name} market={market} user={user} onboarding={onboarding} />;
}

function Onboarding({ onboarding: o }: { onboarding: Onboarding }) {
  return (
    <div className="onboarding">
      <div className="label">SET UP TRADING · ONE TIME</div>
      <Step
        n={1}
        done={o.builderApproved}
        title="Approve the HyperHero builder fee"
        body={`Lets HyperHero add its fee to your orders, up to ${BUILDER_MAX_FEE_RATE}. Every $1 of fee earns 500 $aura.`}
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

function OrderForm({ market, user, onboarding }: { market: Market; user: `0x${string}`; onboarding: Onboarding }) {
  const qc = useQueryClient();
  const active = useActiveAsset(user, market.name);
  const [isBuy, setIsBuy] = useState(true);
  const [kind, setKind] = useState<'market' | 'limit'>('market');
  const [usd, setUsd] = useState('');
  const [limitPx, setLimitPx] = useState('');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [leverage, setLev] = useState(Math.min(10, market.maxLeverage));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const current = active.data?.leverage;
  useEffect(() => {
    if (current) setLev(current.value);
  }, [current?.value]);

  const px = kind === 'limit' ? Number(limitPx) : market.midPx;
  const notional = Number(usd) || 0;
  const size = px > 0 ? notional / px : 0;
  const fee = notional * BUILDER_FEE_RATE;
  const available = active.data ? Number(active.data.availableToTrade[isBuy ? 0 : 1]) : null;

  async function submit() {
    const trader = onboarding.trader;
    if (!trader) return;
    setBusy(true);
    setResult(null);
    try {
      if (current && current.value !== leverage) {
        await setLeverage(trader, market.asset, leverage, current.type === 'cross');
      }
      const text = await placeOrder(trader, {
        market,
        isBuy,
        kind,
        size,
        limitPx: kind === 'limit' ? Number(limitPx) : undefined,
        reduceOnly,
        takeProfit: tpsl && Number(tp) > 0 ? Number(tp) : undefined,
        stopLoss: tpsl && Number(sl) > 0 ? Number(sl) : undefined,
      });
      setResult({ ok: true, text });
      setUsd('');
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
      <div className="seg" role="group" aria-label="Side">
        <button type="button" className={isBuy ? 'on long' : ''} aria-pressed={isBuy} onClick={() => setIsBuy(true)}>LONG</button>
        <button type="button" className={!isBuy ? 'on short' : ''} aria-pressed={!isBuy} onClick={() => setIsBuy(false)}>SHORT</button>
      </div>
      <div className="seg small" role="group" aria-label="Order type">
        <button type="button" className={kind === 'market' ? 'on' : ''} aria-pressed={kind === 'market'} onClick={() => setKind('market')}>MARKET</button>
        <button type="button" className={kind === 'limit' ? 'on' : ''} aria-pressed={kind === 'limit'} onClick={() => setKind('limit')}>LIMIT</button>
      </div>

      {kind === 'limit' && (
        <label className="field">
          <span className="label">PRICE (USD)</span>
          <input className="input mono" inputMode="decimal" value={limitPx} placeholder={fmtPx(market.midPx)} onChange={(e) => setLimitPx(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span className="label">SIZE (USD)</span>
        <input className="input mono" inputMode="decimal" value={usd} placeholder="0.00" onChange={(e) => setUsd(e.target.value)} />
        <span className="muted small mono">
          ≈ {fmtNum(size, market.szDecimals)} {market.name}
          {available !== null && <> · available {fmtUsd(available)}</>}
        </span>
      </label>

      <label className="field">
        <span className="label">LEVERAGE · {leverage}x {current?.type === 'isolated' ? 'ISOLATED' : 'CROSS'}</span>
        <input type="range" min={1} max={market.maxLeverage} value={leverage} onChange={(e) => setLev(Number(e.target.value))} />
      </label>

      <div className="checks">
        <label><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} /> Reduce only</label>
        <label><input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} /> TP / SL</label>
      </div>
      {tpsl && (
        <div className="row2">
          <label className="field">
            <span className="label">TAKE PROFIT</span>
            <input className="input mono" inputMode="decimal" value={tp} placeholder="Price" onChange={(e) => setTp(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">STOP LOSS</span>
            <input className="input mono" inputMode="decimal" value={sl} placeholder="Price" onChange={(e) => setSl(e.target.value)} />
          </label>
        </div>
      )}

      <dl className="preview">
        <div><dt>Builder fee ({(BUILDER_FEE_RATE * 100).toFixed(3)}%)</dt><dd className="mono">{fmtUsd(fee, 4)}</dd></div>
        <div className="aura-line"><dt>$aura earned on this fill</dt><dd className="mono">+{fmtAura(auraForNotional(notional))}</dd></div>
      </dl>

      <button type="submit" className={`btn big ${isBuy ? 'long' : 'short'}`} disabled={busy || notional <= 0 || !onboarding.trader}>
        {busy ? 'SENDING…' : `${isBuy ? 'LONG' : 'SHORT'} ${market.name}`}
      </button>
      {result && <div className={`notice ${result.ok ? 'ok' : 'err'}`}>{result.text}</div>}
    </form>
  );
}
