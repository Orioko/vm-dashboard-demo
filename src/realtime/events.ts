import { createAction } from '@reduxjs/toolkit';

import type { Task, Vm } from '../types';

export interface VmUpdatedEvent {
  type: 'vm.updated';
  seq: number;
  payload: { id: string; changes: Partial<Vm> };
}

export interface TaskUpdatedEvent {
  type: 'task.updated';
  seq: number;
  payload: Task;
}

export type RealtimeEvent = VmUpdatedEvent | TaskUpdatedEvent;

export function isRealtimeEvent(data: unknown): data is RealtimeEvent {
  if (typeof data !== 'object' || data === null) return false;

  const { type, seq, payload } = data as Record<string, unknown>;
  return (type === 'vm.updated' || type === 'task.updated') && typeof seq === 'number' && typeof payload === 'object';
}

export function getEventKey(event: RealtimeEvent) {
  return event.type === 'vm.updated' ? `vm:${event.payload.id}` : `task:${event.payload.id}`;
}

export function mergeEvents(previous: RealtimeEvent, next: RealtimeEvent): RealtimeEvent {
  if (previous.type === 'vm.updated' && next.type === 'vm.updated') {
    return { ...next, payload: { id: next.payload.id, changes: { ...previous.payload.changes, ...next.payload.changes } } };
  }
  return next;
}

export const eventsReceived = createAction<RealtimeEvent[]>('realtime/eventsReceived');
