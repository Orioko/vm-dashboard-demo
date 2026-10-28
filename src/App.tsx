import { useState } from 'react';

import { AppAlerts } from './components/AppAlerts';
import { InventoryTree } from './components/InventoryTree';
import { StatusBar } from './components/StatusBar';
import { TasksPanel } from './components/TasksPanel';
import { VmTable } from './components/VmTable';
import { useViewState } from './hooks/useViewState';
import { useRealtime } from './realtime/useRealtime';

export function App() {
  const [batching, setBatching] = useState(true);
  const [view, updateView] = useViewState();
  useRealtime({ batching });

  return (
    <div className="app">
      <header className="masthead">
        <svg className="masthead__logo" viewBox="0 0 16 16" aria-hidden>
          <rect x="1" y="2" width="14" height="3" rx="0.5" />
          <rect x="1" y="6.5" width="14" height="3" rx="0.5" />
          <rect x="1" y="11" width="14" height="3" rx="0.5" />
        </svg>
        <span className="masthead__title">VM Dashboard</span>
        <span className="masthead__divider" aria-hidden />
        <span className="masthead__context">Demo inventory</span>
      </header>

      <AppAlerts />

      <div className="workspace">
        <InventoryTree scope={view.scope} onScopeChange={(scope) => updateView({ scope }, 'push')} />
        <main className="content">
          <VmTable view={view} onViewChange={updateView} />
        </main>
      </div>

      <TasksPanel />
      <StatusBar batching={batching} onBatchingChange={setBatching} />
    </div>
  );
}
