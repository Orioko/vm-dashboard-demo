import { describe, expect, it } from 'vitest';

import { eventsReceived, type RealtimeEvent } from '../realtime/events';
import type { Vm } from '../types';
import { fetchVmsSnapshot, vmsReducer } from './vmsSlice';

const vm = (id: string, cpuUsage: number): Vm => ({
  id,
  name: id,
  cluster: 'cluster-a',
  host: 'node-01',
  ipAddress: '10.10.0.2',
  os: 'Debian 12',
  status: 'running',
  cpuUsage,
  memoryMb: 4096,
  memoryUsage: 30,
  updatedAt: 0,
});

const cpuEvent = (seq: number, id: string, cpuUsage: number): RealtimeEvent => ({
  type: 'vm.updated',
  seq,
  payload: { id, changes: { cpuUsage } },
});

const snapshotLoaded = (requestId: string, items: Vm[], seq: number) =>
  fetchVmsSnapshot.fulfilled({ items, seq }, requestId, undefined);

describe('vmsSlice: snapshot and event stream', () => {
  it('replays events that arrived while the snapshot was loading, if they are newer than it', () => {
    let state = vmsReducer(undefined, fetchVmsSnapshot.pending('r1', undefined));
    state = vmsReducer(state, eventsReceived([cpuEvent(5, 'a', 50), cpuEvent(11, 'a', 90)]));
    state = vmsReducer(state, snapshotLoaded('r1', [vm('a', 10)], 10));

    expect(state.entities.a.cpuUsage).toBe(90);
    expect(state.pendingPatches).toEqual([]);
  });

  it('drops events that the snapshot already includes', () => {
    let state = vmsReducer(undefined, fetchVmsSnapshot.pending('r1', undefined));
    state = vmsReducer(state, eventsReceived([cpuEvent(5, 'a', 50)]));
    state = vmsReducer(state, snapshotLoaded('r1', [vm('a', 10)], 10));
    state = vmsReducer(state, eventsReceived([cpuEvent(9, 'a', 70)]));

    expect(state.entities.a.cpuUsage).toBe(10);
  });

  it('applies live events once the snapshot is ready', () => {
    let state = vmsReducer(undefined, fetchVmsSnapshot.pending('r1', undefined));
    state = vmsReducer(state, snapshotLoaded('r1', [vm('a', 10), vm('b', 20)], 10));
    const untouched = state.entities.b;

    state = vmsReducer(state, eventsReceived([cpuEvent(12, 'a', 33)]));

    expect(state.entities.a.cpuUsage).toBe(33);
    expect(state.entities.b).toBe(untouched);
  });

  it('bumps structureVersion only for changes that can affect order or filters', () => {
    let state = vmsReducer(undefined, fetchVmsSnapshot.pending('r1', undefined));
    state = vmsReducer(state, snapshotLoaded('r1', [vm('a', 10)], 10));
    const afterSnapshot = state.structureVersion;

    state = vmsReducer(state, eventsReceived([cpuEvent(11, 'a', 40)]));
    expect(state.structureVersion).toBe(afterSnapshot);

    state = vmsReducer(
      state,
      eventsReceived([{ type: 'vm.updated', seq: 12, payload: { id: 'a', changes: { status: 'stopping' } } }]),
    );
    expect(state.structureVersion).toBe(afterSnapshot + 1);
  });

  it('ignores a response from an outdated snapshot request', () => {
    let state = vmsReducer(undefined, fetchVmsSnapshot.pending('r1', undefined));
    state = vmsReducer(state, fetchVmsSnapshot.pending('r2', undefined));
    state = vmsReducer(state, snapshotLoaded('r1', [vm('a', 10)], 10));

    expect(state.ids).toEqual([]);
    expect(state.loadStatus).toBe('loading');

    state = vmsReducer(state, snapshotLoaded('r2', [vm('a', 15)], 12));
    expect(state.entities.a.cpuUsage).toBe(15);
  });
});
