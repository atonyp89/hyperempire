// The empire's main scene. Buildings are hotspots over the town image; the Exchange opens trading.

type Building = {
  id: 'townhall' | 'tavern' | 'exchange' | 'garden';
  name: string;
  detail: string;
  /** Hotspot box as percentages of the 320x180 scene. */
  box: { left: number; top: number; width: number; height: number };
  ready: boolean;
};

const BUILDINGS: Building[] = [
  { id: 'townhall', name: 'TOWNHALL', detail: 'UPGRADES · SOON', box: { left: 33.5, top: 5.5, width: 30.5, height: 39 }, ready: false },
  { id: 'tavern', name: 'TAVERN', detail: 'RECRUIT HEROES · PHASE 2', box: { left: 0.5, top: 11, width: 21, height: 34 }, ready: false },
  { id: 'exchange', name: 'EXCHANGE', detail: 'TRADE PERPS · EARN $AURA', box: { left: 78, top: 7, width: 18, height: 38 }, ready: true },
  { id: 'garden', name: 'GARDEN', detail: 'GROW SEEDS · PHASE 3', box: { left: 0, top: 63, width: 24, height: 37 }, ready: false },
];

export function EmpireScene({ onOpenExchange }: { onOpenExchange: () => void }) {
  return (
    <div className="scene-wrap">
      <div className="scene">
        <img
          className="scene-img"
          src="/empire/town.png"
          alt="Your empire: the Townhall at the center behind a plaza with statue pools, the Tavern on the left, the Exchange on the right and the Garden fields at the bottom left"
        />
        {BUILDINGS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hotspot ${b.ready ? 'ready' : 'locked'}`}
            style={{ left: `${b.box.left}%`, top: `${b.box.top}%`, width: `${b.box.width}%`, height: `${b.box.height}%` }}
            onClick={b.ready ? onOpenExchange : undefined}
            aria-disabled={!b.ready}
            aria-label={`${b.name}: ${b.detail}${b.ready ? '' : ' (not available yet)'}`}
          >
            <span className="plate">
              <span className="plate-name">{b.name}</span>
              <span className="plate-detail">{b.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
