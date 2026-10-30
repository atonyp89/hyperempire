// The Tavern: recruit Farmers for $aura. Each recruit rolls a grade (the Miners' odds) and two perks within the
// grade's range, then joins the roster; Farmers are put to work in the Garden. Heroes come here later.

import { FARMER_PERKS, GRADES } from '@server/contract';
import { fmtAura } from '../../shared/format';
import { useMe } from '../../shared/session';
import { BuildingModal } from '../../shared/ui/BuildingModal';
import { useFarmers, type Farmers } from '../hooks/useFarmers';
import { farmerName, farmerPerks, farmerPortrait } from '../lib/farmers';
import { Overlay } from '../ui/Overlay';

type Props = { open: boolean; onClose: () => void };

const ODDS = { common: '70%', uncommon: '22%', rare: '6.5%', epic: '1.4%', legendary: '0.1%' } as const;

export function TavernModal({ open, onClose }: Props) {
  const f = useFarmers(open);
  return (
    <BuildingModal open={open} onClose={onClose} title="THE TAVERN" subtitle={<>Recruit Farmers for your Garden · heroes coming later</>}>
      {f.ready ? <Recruit f={f} /> : <SignIn f={f} />}
      {f.error && f.ready && (
        <div className="notice err garden-err" role="alert">
          {f.error}
        </div>
      )}
    </BuildingModal>
  );
}

function SignIn({ f }: { f: Farmers }) {
  const s = f.session;
  return (
    <section className="panel th-signin" aria-label="Sign in">
      {!s.address ? (
        <div className="muted">Connect your wallet to enter the Tavern.</div>
      ) : f.loading ? (
        <div className="muted">Opening the Tavern…</div>
      ) : (
        <button type="button" className="btn primary big" disabled={s.signingIn} onClick={() => void s.signIn()}>
          {s.signingIn ? 'CHECK YOUR WALLET…' : 'SIGN IN'}
        </button>
      )}
    </section>
  );
}

function Recruit({ f }: { f: Farmers }) {
  const me = useMe();
  const aura = me.data?.aura ?? 0;
  return (
    <div className="tavern-grid">
      <section className="panel garden-panel" aria-label="Recruit a Farmer">
        <span className="label">RECRUIT A FARMER</span>
        <div className="tavern-recruit">
          <span className="farmer-portrait big" style={farmerPortrait} aria-hidden="true" />
          <div className="small muted">
            Farmers tend your Garden: up to 3 work at once, and each adds yield and cuts growing time. Every recruit rolls a grade, then both perks within
            that grade’s range.
          </div>
        </div>
        <button type="button" className="btn primary" disabled={aura < f.recruitAura} onClick={f.recruit}>
          {aura < f.recruitAura ? 'NOT ENOUGH $AURA' : <>RECRUIT · <span className="gem" aria-hidden="true" /> {fmtAura(f.recruitAura)} $AURA</>}
        </button>
        <table className="th-gives-table farmer-odds">
          <thead>
            <tr>
              <th>GRADE</th>
              <th>CHANCE</th>
              <th>YIELD</th>
              <th>GROWTH</th>
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => (
              <tr key={g}>
                <td className={`strong grade-text-${g}`}>{g[0].toUpperCase() + g.slice(1)}</td>
                <td className="mono">{ODDS[g]}</td>
                <td className="mono">
                  +{FARMER_PERKS[g].yield[0]}–{FARMER_PERKS[g].yield[1]}%
                </td>
                <td className="mono">
                  −{FARMER_PERKS[g].growth[0]}–{FARMER_PERKS[g].growth[1]}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel garden-panel" aria-label="Your Farmers">
        <span className="label">YOUR FARMERS · {f.farmers.length}</span>
        {f.farmers.length ? (
          <div className="farmer-roster">
            {f.farmers.map((x) => (
              <div key={x.id} className={`farmer-card grade-${x.grade}`}>
                <span className="farmer-portrait inv-icon" style={farmerPortrait} aria-hidden="true" />
                <span className={`strong grade-text-${x.grade}`}>{farmerName(x)}</span>
                <span className="small mono">{farmerPerks(x)}</span>
                <span className="small muted">{x.assigned ? 'In the Garden' : 'Resting'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="small muted">No Farmers yet. Recruit one, then put it to work in the Garden.</div>
        )}
      </section>

      {f.recruited && (
        <Overlay label="New Farmer" onClose={f.clearRecruited} closeOnClick className="pack-opened">
          <span className="label">A FARMER JOINS YOU</span>
          <div className={`farmer-reveal grade-${f.recruited.grade}`}>
            <span className="farmer-portrait inv-icon" style={farmerPortrait} aria-hidden="true" />
          </div>
          <span className={`strong grade-text-${f.recruited.grade}`}>{farmerName(f.recruited)}</span>
          <span className="mono">{farmerPerks(f.recruited)}</span>
          <div className="small muted">Click anywhere to close</div>
        </Overlay>
      )}
    </div>
  );
}
