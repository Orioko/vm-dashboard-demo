export type SequenceCheck = 'ok' | 'gap' | 'duplicate';

export interface SequenceTracker {
  check: (seq: number) => SequenceCheck;
  reset: () => void;
}

export function createSequenceTracker(): SequenceTracker {
  let last: number | null = null;

  return {
    check(seq) {
      if (last !== null && seq <= last) return 'duplicate';

      const result = last === null || seq === last + 1 ? 'ok' : 'gap';
      last = seq;
      return result;
    },
    reset() {
      last = null;
    },
  };
}
