import { useEffect, useRef } from 'react';

import { metrics } from '../metrics';
import { useAppDispatch } from '../store';
import { connectionStatusChanged } from '../store/connectionSlice';
import { resync } from '../store/resync';
import { createEventBuffer } from './eventBuffer';
import { eventsReceived, getEventKey, isRealtimeEvent, mergeEvents, type RealtimeEvent } from './events';
import { createSequenceTracker } from './sequence';
import { createSocketClient } from './socketClient';

const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 3_000;

function getSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

export function useRealtime({ batching }: { batching: boolean }) {
  const dispatch = useAppDispatch();
  const batchingRef = useRef(batching);
  batchingRef.current = batching;

  useEffect(() => {
    const sequence = createSequenceTracker();

    const apply = (events: RealtimeEvent[]) => {
      metrics.storeUpdates += 1;
      dispatch(eventsReceived(events));
    };

    const buffer = createEventBuffer<RealtimeEvent>({ onFlush: apply, getKey: getEventKey, merge: mergeEvents });

    const client = createSocketClient({
      url: getSocketUrl(),
      pingIntervalMs: PING_INTERVAL_MS,
      pongTimeoutMs: PONG_TIMEOUT_MS,
      onMessage: (data) => {
        if (!isRealtimeEvent(data)) return;

        const check = sequence.check(data.seq);
        if (check === 'duplicate') return;
        if (check === 'gap') dispatch(resync('gap'));

        metrics.eventsReceived += 1;

        if (batchingRef.current) {
          buffer.push(data);
        } else {
          buffer.flush();
          apply([data]);
        }
      },
      onOpen: () => {
        sequence.reset();
        dispatch(resync('connected'));
      },
      onStatusChange: (status) => dispatch(connectionStatusChanged(status)),
    });

    client.connect();

    return () => {
      client.close();
      buffer.dispose();
    };
  }, [dispatch]);
}
