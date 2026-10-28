export type Scheduler = (flush: () => void) => () => void;

const MAX_FLUSH_DELAY_MS = 100;

export const frameScheduler: Scheduler = (flush) => {
  let done = false;
  let frame = 0;

  const cancel = () => {
    done = true;
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
  const run = () => {
    if (done) return;
    cancel();
    flush();
  };

  const timer = setTimeout(run, MAX_FLUSH_DELAY_MS);
  if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(run);

  return cancel;
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
