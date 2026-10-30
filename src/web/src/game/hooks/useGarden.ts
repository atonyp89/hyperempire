// The Garden, kept by the HyperEmpire API: what grows in each plot, the inventory (seed packs, graded seeds and
// harvest), and $gold for buying packs. The server decides every stage; between fetches this hook ticks each plant forward on the server's clock, so plants grow
// on screen without polling.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CROPS, cropStage, yieldOf, type CropId, type GardenPlotView, type GardenView, type HarvestResponse, type OpenPacksResponse } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

/** A "+4" that floats up from a harvested plot and fades. */
export type HarvestPop = { id: number; slot: number; item: string; qty: number };
/** A stable empty list, so the Farmers' walking loop isn't restarted on every render. */
const NO_FARMERS: GardenView['farmers'] = [];

/** How long a pop stays on screen; matches the `harvest-pop` animation in game.css. */
const POP_MS = 1400;

export function useGarden(enabled = true) {
  const session = useSession();
  const qc = useQueryClient();
  const key = ['garden', NETWORK, session.address?.toLowerCase()];
  const q = useQuery({
    queryKey: key,
    enabled: enabled && session.signedIn,
    queryFn: async () => ({ view: await session.call<GardenView>('/garden'), at: Date.now() }),
  });

  const store = (view: GardenView) => {
    qc.setQueryData(key, { view, at: Date.now() });
    void qc.invalidateQueries({ queryKey: ['gold', NETWORK] });
    void qc.invalidateQueries({ queryKey: ['me', NETWORK] });
  };
  const buyM = useMutation({
    mutationFn: (v: { crop: CropId; qty: number }) => session.call<GardenView>('/garden/buy', { method: 'POST', body: v }),
    onSuccess: store,
  });
  /** The seeds the last opened pack gave, shown until dismissed. */
  const [opened, setOpened] = useState<string[] | null>(null);
  const reveal = (r: OpenPacksResponse) => {
    store(r.garden);
    setOpened(r.opened);
  };
  const openM = useMutation({
    mutationFn: (crop: CropId) => session.call<OpenPacksResponse>('/garden/open', { method: 'POST', body: { crop } }),
    onSuccess: reveal,
  });
  const shopM = useMutation({
    mutationFn: (crop: CropId) => session.call<OpenPacksResponse>('/garden/buy', { method: 'POST', body: { crop, open: true } }),
    onSuccess: reveal,
  });
  const plantM = useMutation({
    mutationFn: (v: { seed: string; slots: number[] }) => session.call<GardenView>('/garden/plant', { method: 'POST', body: v }),
    onSuccess: store,
  });
  const [pops, setPops] = useState<HarvestPop[]>([]);
  const popId = useRef(0);
  /** Float what each plot gave over it: its crop and yield, as the server counted them. */
  const popHarvest = (slots: number[], plots: GardenPlotView[]) => {
    const added = slots.flatMap((slot): HarvestPop[] => {
      const p = plots[slot];
      return p?.crop ? [{ id: ++popId.current, slot, item: p.crop, qty: yieldOf(CROPS[p.crop], p.grade ?? 'common') }] : [];
    });
    setPops((p) => [...p, ...added]);
    window.setTimeout(() => setPops((p) => p.filter((x) => !added.includes(x))), POP_MS);
  };

  const harvestM = useMutation({
    mutationFn: (slots: number[]) => session.call<HarvestResponse>('/garden/harvest', { method: 'POST', body: { slots } }),
    onSuccess: (r) => store(r.garden),
  });

  // Server time now: the view's clock plus what has passed here since it arrived. Re-renders four times a second,
  // reading the time fresh each render, so a countdown never lags behind a just-arrived view.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [enabled]);
  const data = q.data;
  const now = data ? data.view.now + (Date.now() - data.at) : Date.now();

  const plots = useMemo<GardenPlotView[]>(
    () =>
      (data?.view.plots ?? []).map((p) => {
        if (!p.crop || p.plantedAt == null || p.readyAt == null) return p;
        const crop = CROPS[p.crop];
        const stage = cropStage(crop, p.plantedAt, p.readyAt, now);
        return { ...p, stage, ripe: stage === crop.stages - 1 };
      }),
    [data, now],
  );

  const busy = buyM.isPending || shopM.isPending || openM.isPending || plantM.isPending || harvestM.isPending;

  return {
    session,
    ready: !!data,
    loading: q.isLoading,
    busy,
    error: (buyM.error ?? shopM.error ?? openM.error ?? plantM.error ?? harvestM.error ?? q.error)?.message ?? null,
    now,
    plots,
    gold: data?.view.gold ?? 0,
    /** Farmers working the Garden, and what their perks add up to. */
    farmers: data?.view.farmers ?? NO_FARMERS,
    bonus: data?.view.bonus ?? { yieldPct: 0, growthPct: 0 },
    /** How fast crops grow: 1, or more on the dev server. */
    speed: data?.view.speed ?? 1,
    inventory: data?.view.inventory ?? {},
    // While a request runs, further clicks are ignored rather than disabling every control, which made the whole
    // screen blink dim on each buy, plant and harvest.
    /** Buy `qty` packs of a crop's seeds. */
    buy: (crop: CropId, qty: number) => !busy && buyM.mutate({ crop, qty }),
    /** Buy one pack and open it straight away (the shop); `opened` then holds its seeds. */
    buyAndOpen: (crop: CropId) => !busy && shopM.mutate(crop),
    /** Open one pack already held; `opened` then holds its seeds. */
    open: (crop: CropId) => !busy && openM.mutate(crop),
    opened,
    dismissOpened: () => setOpened(null),
    /** Plant a seed item ("wheat-seed:rare") in each slot. */
    plant: (seed: string, slots: number[]) => !busy && plantM.mutate({ seed, slots }),
    harvest: (slots: number[]) => {
      if (busy || !data) return;
      const before = data.view.plots;
      harvestM.mutate(slots, { onSuccess: () => popHarvest(slots, before) });
    },
    pops,
  };
}

export type Garden = ReturnType<typeof useGarden>;
