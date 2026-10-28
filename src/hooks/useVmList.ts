import { useEffect, useMemo, useState } from 'react';

import { useAppSelector, useAppStore } from '../store';
import { selectAllVms } from '../store/vmsSlice';

function useTick(intervalMs: number | null) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}

export function useVmList(refreshMs: number | null = null) {
  const store = useAppStore();
  const structureVersion = useAppSelector((state) => state.vms.structureVersion);
  const tick = useTick(refreshMs);

  return useMemo(() => selectAllVms(store.getState()), [store, structureVersion, tick]);
}
