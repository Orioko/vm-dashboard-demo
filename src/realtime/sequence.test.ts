import { describe, expect, it } from 'vitest';

import { createSequenceTracker } from './sequence';

describe('createSequenceTracker', () => {
  it('accepts any first seq and then consecutive ones', () => {
    const tracker = createSequenceTracker();
    expect([105, 106, 107].map(tracker.check)).toEqual(['ok', 'ok', 'ok']);
  });

  it('reports a gap when seq jumps, then continues from the new value', () => {
    const tracker = createSequenceTracker();
    tracker.check(105);

    expect(tracker.check(109)).toBe('gap');
    expect(tracker.check(110)).toBe('ok');
  });

  it('reports duplicates and old events without moving forward', () => {
    const tracker = createSequenceTracker();
    tracker.check(105);
    tracker.check(106);

    expect(tracker.check(106)).toBe('duplicate');
    expect(tracker.check(101)).toBe('duplicate');
    expect(tracker.check(107)).toBe('ok');
  });

  it('starts over after reset, as on a new connection', () => {
    const tracker = createSequenceTracker();
    tracker.check(500);
    tracker.reset();

    expect(tracker.check(20)).toBe('ok');
  });
});
