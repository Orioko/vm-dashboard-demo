# VM Dashboard Demo

A real-time admin UI for **10,000 virtual machines** that stays fast while hundreds of updates per second arrive over a WebSocket.

It is a companion project for an article about building management interfaces for virtualization and VDI platforms: the kind of UI where the data changes on its own, operations take minutes, and showing a stale "Running" can make an administrator take the wrong decision.

<!-- TODO: add a GIF of the dashboard here -->

## What it demonstrates

| Problem | Pattern | Where |
| --- | --- | --- |
| One socket per page, double reconnects, zombie timers | A single framework-agnostic socket client: exponential backoff with jitter, reconnect only from `close` | [`socketClient.ts`](src/realtime/socketClient.ts) |
| A half-open connection that looks fine but delivers nothing | Heartbeat: if nothing arrives within a timeout after a ping, the client drops the socket and reconnects | [`socketClient.ts`](src/realtime/socketClient.ts) |
| Hundreds of events per second → hundreds of renders | Buffer events and flush on the next frame or after 100 ms, whichever comes first (frames are throttled in covered windows); coalesce updates of the same VM | [`eventBuffer.ts`](src/realtime/eventBuffer.ts), [`events.ts`](src/realtime/events.ts) |
| Events lost between "load the list" and "subscribe" | Subscribe first, load the snapshot on every (re)connect, replay buffered events newer than the snapshot by sequence number | [`vmsSlice.ts`](src/store/vmsSlice.ts), [`useRealtime.ts`](src/realtime/useRealtime.ts) |
| Events lost on a live connection | Every event carries a `seq`; a jump means something was lost, and the client reloads the snapshot | [`sequence.ts`](src/realtime/sequence.ts), [`resync.ts`](src/store/resync.ts) |
| A table with 10,000 live rows re-rendering on every update | Each row subscribes to its own VM by id. The list the table sorts is rebuilt only when order-relevant fields change (state, a new snapshot), or once per second when sorting by a live metric | [`useVmList.ts`](src/hooks/useVmList.ts), [`VmRow.tsx`](src/components/VmRow.tsx), [`vmsSlice.ts`](src/store/vmsSlice.ts) |
| Rendering 10,000 rows | Headless TanStack Table for sorting, TanStack Virtual for windowing, sticky header via `scrollMargin` | [`VmTable.tsx`](src/components/VmTable.tsx) |
| Bulk actions on things the user cannot see | Actions apply only to selected rows that are visible; changing the inventory scope clears the selection | [`VmTable.tsx`](src/components/VmTable.tsx) |
| Long-running operations | Operations are tasks with progress; the UI shows "Queued…" and transitional states instead of optimistic results. A task event that arrives before the HTTP response is never overwritten by it | [`tasksSlice.ts`](src/store/tasksSlice.ts), [`TasksPanel.tsx`](src/components/TasksPanel.tsx) |
| Sharing what you see | Scope, sorting, state filter and search live in the URL; inventory navigation adds history entries, so Back works | [`viewState.ts`](src/viewState.ts), [`useViewState.ts`](src/hooks/useViewState.ts) |
| Keyboard and context menus | Roving focus over rows: arrows, Page Up/Down, Home/End, Space to select, Shift+arrows to extend, Ctrl+A, Shift+F10 or the Menu key for the context menu | [`VmTable.tsx`](src/components/VmTable.tsx), [`ContextMenu.tsx`](src/components/ContextMenu.tsx) |
| Testing real-time code | `mock-socket` with fake timers for reconnect and heartbeat logic; reducer tests for the snapshot/stream and task races | `*.test.ts` |

The status bar at the bottom shows events, store updates and row renders per second. Toggle **Batch events per frame** to compare: without batching every event becomes a store update; with it there is at most one per frame, however many events arrive. Thanks to per-row subscriptions the page stays responsive either way.

The **Simulate** links in the status bar break things on purpose:

- **disconnect** closes the socket on the server: watch the reconnect, the "inventory may be out of date" alert and the snapshot resync;
- **stalled connection** keeps the socket open but stops sending anything, including pongs: the heartbeat notices within a few seconds;
- **lost events** silently skips 25 events: the sequence check notices the gap and reloads the snapshot (see "Gap resyncs").

## Interface

The layout follows the conventions of virtualization management consoles, so it feels familiar to the people who use them every day: an inventory tree (clusters and nodes with VM counts and error markers), a dense data grid with a selection toolbar (Power on / Shut down / Restart) and a right-click menu instead of per-row buttons, VM states as icon plus label, a collapsible **Recent tasks** panel, and full-width application alerts. Light and dark themes follow the system setting.

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The mock API runs on port 4000; Vite proxies `/api` and `/ws` to it.

The mock server can be tuned with environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VM_COUNT` | `10000` | Number of generated VMs |
| `EVENTS_PER_SECOND` | `500` | Approximate rate of metric updates |
| `SNAPSHOT_DELAY_MS` | `300` | Artificial latency of `GET /api/vms`, to make the snapshot/stream race visible |
| `API_PORT` | `4000` | Port of the mock API |

Other scripts: `npm test`, `npm run typecheck`, `npm run build`.

## Architecture

```
mock server (Node + ws)
  ├─ GET  /api/vms            snapshot { items, seq }
  ├─ GET  /api/tasks          active and recent tasks
  ├─ POST /api/actions        { action, vmIds } → tasks
  └─ WS   /ws                 { type, seq, payload } events: vm.updated, task.updated

browser
  socketClient ──► eventBuffer (per frame, coalesced) ──► one Redux action per flush
       │                                                        │
       └─ on every open: fetch snapshot + tasks ──► vmsSlice: replay events with seq > snapshot.seq
                                                                 │
                                         VmTable (TanStack Table + Virtual) ◄─┘
```

Every server event carries a monotonically increasing `seq`. The snapshot reports the `seq` it was taken at, so the client can tell which events are already included in it.

## Stack

React 18, TypeScript, Redux Toolkit, TanStack Table, TanStack Virtual, Vite, Vitest, mock-socket, ws.

## License

[MIT](LICENSE)
