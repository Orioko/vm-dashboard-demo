import { useEffect, useState } from 'react';

import { metrics, type Metrics } from '../metrics';
import { useAppSelector } from '../store';

const CONNECTION_LABELS = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  open: 'Connected',
  reconnecting: 'Reconnecting…',
  closed: 'Disconnected',
} as const;

function useRates() {
  const [rates, setRates] = useState<Metrics>({ eventsReceived: 0, storeUpdates: 0, rowCommits: 0 });

  useEffect(() => {
    let previous = { ...metrics };
    const id = setInterval(() => {
      const current = { ...metrics };
      setRates({
        eventsReceived: current.eventsReceived - previous.eventsReceived,
        storeUpdates: current.storeUpdates - previous.storeUpdates,
        rowCommits: current.rowCommits - previous.rowCommits,
      });
      previous = current;
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return rates;
}

interface StatusBarProps {
  batching: boolean;
  onBatchingChange: (batching: boolean) => void;
}

export function StatusBar({ batching, onBatchingChange }: StatusBarProps) {
  const rates = useRates();
  const status = useAppSelector((state) => state.connection.status);
  const reconnects = useAppSelector((state) => state.connection.reconnects);

  const simulate = (failure: 'drop-connections' | 'stall-connections') => {
    fetch(`/api/debug/${failure}`, { method: 'POST' }).catch(() => undefined);
  };

  return (
    <footer className="statusbar">
      <span className={`statusbar__connection statusbar__connection--${status}`} role="status">
        <span className="statusbar__dot" aria-hidden />
        {CONNECTION_LABELS[status]}
      </span>

      <dl className="statusbar__metrics">
        <div>
          <dt>Events/s</dt>
          <dd>{rates.eventsReceived}</dd>
        </div>
        <div>
          <dt>Store updates/s</dt>
          <dd>{rates.storeUpdates}</dd>
        </div>
        <div>
          <dt>Row renders/s</dt>
          <dd>{rates.rowCommits}</dd>
        </div>
        <div>
          <dt>Reconnects</dt>
          <dd>{reconnects}</dd>
        </div>
      </dl>

      <div className="statusbar__controls">
        <label className="statusbar__switch">
          <input type="checkbox" checked={batching} onChange={(event) => onBatchingChange(event.target.checked)} />
          Batch events per frame
        </label>
        <span className="statusbar__simulate">
          Simulate:
          <button type="button" className="link-button" onClick={() => simulate('drop-connections')}>
            disconnect
          </button>
          <button type="button" className="link-button" onClick={() => simulate('stall-connections')}>
            stalled connection
          </button>
        </span>
      </div>
    </footer>
  );
}
