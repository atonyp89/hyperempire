import { useConnect, useConnection, useConnectors, useDisconnect } from 'wagmi';
import { NETWORK } from '../config';
import { fmtAura, shortAddr } from '../lib/format';

type Props = { auraEarned: number | null; referral: string | null; onOpen: (id: 'exchange' | 'townhall') => void };

export function Header({ auraEarned, referral, onOpen }: Props) {
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
        {referral && <span className="chip muted" title="Referral code captured from your link">REF {referral}</span>}
        <span className={`chip ${NETWORK === 'testnet' ? 'warn' : ''}`}>{NETWORK.toUpperCase()}</span>
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
