export type Scheduler = (flush: () => void) => () => void;

const HIDDEN_TAB_FLUSH_MS = 250;

export const frameScheduler: Scheduler = (flush) => {
  if (typeof document === 'undefined' || document.hidden) {
    const id = setTimeout(flush, HIDDEN_TAB_FLUSH_MS);
    return () => clearTimeout(id);
  }

  const id = requestAnimationFrame(flush);
  return () => cancelAnimationFrame(id);
};

export interface EventBufferOptions<T> {
  onFlush: (events: T[]) => void;
  schedule?: Scheduler;
  getKey?: (event: T) => string | undefined;
  merge?: (previous: T, next: T) => T;
}

export interface EventBuffer<T> {
  push: (event: T) => void;
  flush: () => void;
  dispose: () => void;
}

export function createEventBuffer<T>({
  onFlush,
  schedule = frameScheduler,
  getKey,
  merge = (_previous, next) => next,
}: EventBufferOptions<T>): EventBuffer<T> {
  let queue = new Map<string | number, T>();
  let unkeyedCounter = 0;
  let cancelScheduled: (() => void) | null = null;

  const flushNow = () => {
    cancelScheduled = null;
    if (queue.size === 0) return;

    const events = [...queue.values()];
    queue = new Map();
    onFlush(events);
  };

  return {
    push(event) {
      const key = getKey?.(event) ?? unkeyedCounter++;
      const previous = queue.get(key);
      queue.set(key, previous === undefined ? event : merge(previous, event));

      if (!cancelScheduled) cancelScheduled = schedule(flushNow);
    },
    flush() {
      cancelScheduled?.();
      flushNow();
    },
    dispose() {
      cancelScheduled?.();
      cancelScheduled = null;
      queue = new Map();
    },
  };
}
