import { describe, expect, it, vi } from 'vitest';

import { createEventBuffer, frameScheduler, type Scheduler } from './eventBuffer';
import { getEventKey, mergeEvents, type RealtimeEvent } from './events';

function createManualScheduler() {
  let scheduled: (() => void) | null = null;
  let scheduleCalls = 0;

  const schedule: Scheduler = (flush) => {
    scheduleCalls += 1;
    scheduled = flush;
    return () => {
      scheduled = null;
    };
  };

  return {
    schedule,
    run: () => {
      const flush = scheduled;
      scheduled = null;
      flush?.();
    },
    get scheduleCalls() {
      return scheduleCalls;
    },
  };
}

const vmEvent = (seq: number, id: string, changes: object): RealtimeEvent => ({
  type: 'vm.updated',
  seq,
  payload: { id, changes },
});

describe('createEventBuffer', () => {
  it('delivers everything pushed before the next frame in a single flush', () => {
    const scheduler = createManualScheduler();
    const onFlush = vi.fn();
    const buffer = createEventBuffer<number>({ onFlush, schedule: scheduler.schedule });

    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    expect(onFlush).not.toHaveBeenCalled();
    expect(scheduler.scheduleCalls).toBe(1);

    scheduler.run();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('coalesces updates of the same VM into one patch with the latest values', () => {
    const scheduler = createManualScheduler();
    const onFlush = vi.fn();
    const buffer = createEventBuffer<RealtimeEvent>({
      onFlush,
      schedule: scheduler.schedule,
      getKey: getEventKey,
      merge: mergeEvents,
    });

    buffer.push(vmEvent(1, 'a', { cpuUsage: 10, memoryUsage: 40 }));
    buffer.push(vmEvent(2, 'b', { cpuUsage: 50 }));
    buffer.push(vmEvent(3, 'a', { cpuUsage: 90 }));
    scheduler.run();

    expect(onFlush).toHaveBeenCalledWith([
      vmEvent(3, 'a', { cpuUsage: 90, memoryUsage: 40 }),
      vmEvent(2, 'b', { cpuUsage: 50 }),
    ]);
  });

  it('flush() delivers immediately and cancels the scheduled flush', () => {
    const scheduler = createManualScheduler();
    const onFlush = vi.fn();
    const buffer = createEventBuffer<number>({ onFlush, schedule: scheduler.schedule });

    buffer.push(1);
    buffer.flush();
    scheduler.run();

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1]);
  });

  it('frameScheduler still flushes when animation frames are throttled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const flush = vi.fn();
    frameScheduler(flush);
    vi.advanceTimersByTime(100);

    expect(flush).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('frameScheduler flushes once even if both the frame and the timer fire', () => {
    vi.useFakeTimers();
    let frameCallback: (() => void) | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      frameCallback = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const flush = vi.fn();
    frameScheduler(flush);
    frameCallback?.();
    vi.advanceTimersByTime(100);

    expect(flush).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('dispose() drops queued events', () => {
    const scheduler = createManualScheduler();
    const onFlush = vi.fn();
    const buffer = createEventBuffer<number>({ onFlush, schedule: scheduler.schedule });

    buffer.push(1);
    buffer.dispose();
    scheduler.run();
    buffer.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });
});
