// The Garden, kept by the HyperEmpire API: what grows in each plot, the inventory (seeds and harvest), and $gold
// for buying seeds. The server
// decides every stage; between fetches this hook ticks each plant forward on the server's clock, so plants grow
// on screen without polling.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CROPS, cropStage, type CropId, type GardenPlotView, type GardenView, type HarvestResponse } from '@server/contract';
import { NETWORK } from '../../shared/network';
import { useSession } from '../../shared/session';

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
  const plantM = useMutation({
    mutationFn: (v: { crop: CropId; slots: number[] }) => session.call<GardenView>('/garden/plant', { method: 'POST', body: v }),
    onSuccess: store,
  });
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

  const busy = buyM.isPending || plantM.isPending || harvestM.isPending;

  return {
    session,
    ready: !!data,
    loading: q.isLoading,
    busy,
    error: (buyM.error ?? plantM.error ?? harvestM.error ?? q.error)?.message ?? null,
    now,
    plots,
    gold: data?.view.gold ?? 0,
    /** How fast crops grow: 1, or more on the dev server. */
    speed: data?.view.speed ?? 1,
    inventory: data?.view.inventory ?? {},
    lastHarvest: harvestM.data?.harvested ?? null,
    // While a request runs, further clicks are ignored rather than disabling every control, which made the whole
    // screen blink dim on each buy, plant and harvest.
    buy: (crop: CropId, qty: number) => !busy && buyM.mutate({ crop, qty }),
    plant: (crop: CropId, slots: number[]) => !busy && plantM.mutate({ crop, slots }),
    harvest: (slots: number[]) => !busy && harvestM.mutate(slots),
  };
}

export type Garden = ReturnType<typeof useGarden>;
