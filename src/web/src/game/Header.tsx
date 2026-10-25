import { useConnect, useConnection, useConnectors, useDisconnect } from 'wagmi';
import { NETWORK, switchNetwork, type Network } from '../shared/network';
import { fmtAura, shortAddr } from '../shared/format';
import type { useDayPhase } from './hooks/useDayPhase';

type Props = { auraEarned: number | null; referral: string | null; onOpen: (id: 'exchange' | 'townhall') => void; day: ReturnType<typeof useDayPhase> };

const PHASE_LABEL = { morning: ['☀', 'MORNING'], evening: ['◐', 'EVENING'], night: ['☾', 'NIGHT'] } as const;

export function Header({ auraEarned, referral, onOpen, day }: Props) {
  return (
    <header className="header">
      <div className="brand">HYPEREMPIRE</div>
      <nav className="nav" aria-label="Sections">
        <button type="button" className="nav-link" onClick={() => onOpen('townhall')}>TOWNHALL</button>
        <button type="button" className="nav-link" onClick={() => onOpen('exchange')}>EXCHANGE</button>
        <span className="soon">TAVERN · SOON</span>
        <span className="soon">LEADERBOARD · SOON</span>
      </nav>
      <div className="header-right">
        <button
          type="button"
          className="chip time-chip"
          onClick={day.cycle}
          title="Time of day follows your clock. Click to preview morning, evening or night."
          aria-label={`Time of day: ${day.phase}${day.mode === 'auto' ? ', following your clock' : ', preview'}. Click to change.`}
        >
          <span className="chip-icon" aria-hidden="true">{PHASE_LABEL[day.phase][0]}</span> {PHASE_LABEL[day.phase][1]} <span className="muted">{day.mode === 'auto' ? 'AUTO' : 'PREVIEW'}</span>
        </button>
        {referral && <span className="chip muted" title="Referral code captured from your link">REF {referral}</span>}
        <NetworkToggle />
        {auraEarned !== null && (
          <span className="chip aura" title="$aura earned from builder fees on your fills (estimate until claimed)">
            <span className="gem" aria-hidden="true" />
            {fmtAura(auraEarned)} <span className="muted">$AURA</span>
          </span>
        )}
        <ConnectButton />
      </div>
    </header>
  );
}

const NETWORKS: { id: Network; label: string }[] = [
  { id: 'testnet', label: 'TESTNET' },
  { id: 'mainnet', label: 'MAINNET' },
];

/** Testnet / Mainnet switch. Mainnet trades real funds, so switching to it asks first. */
function NetworkToggle() {
  const pick = (id: Network) => {
    if (id === NETWORK) return;
    if (id === 'mainnet' && !window.confirm('Switch to Hyperliquid mainnet? Orders there use real funds.')) return;
    switchNetwork(id);
  };
  return (
    <div className="net-toggle" role="radiogroup" aria-label="Hyperliquid network">
      {NETWORKS.map((n) => (
        <button
          key={n.id}
          type="button"
          role="radio"
          aria-checked={NETWORK === n.id}
          className={NETWORK === n.id ? `on ${n.id}` : ''}
          onClick={() => pick(n.id)}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

function ConnectButton() {
  const { address, isConnected } = useConnection();
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button type="button" className="btn ghost" onClick={() => disconnect()} title="Disconnect">
        {shortAddr(address)}
      </button>
    );
  }
  const connector = connectors[0];
  return (
    <button
      type="button"
      className="btn primary"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
    >
      {isPending ? 'CONNECTING…' : 'CONNECT WALLET'}
    </button>
  );
}
