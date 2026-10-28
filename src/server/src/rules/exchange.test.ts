import { expect, test } from 'bun:test';
import { dayOf, dayStart, marginalShare, nextDay, shareOf } from './exchange';

test('days are UTC dates, like the builder-fill file names', () => {
  expect(dayOf(Date.UTC(2026, 9, 26, 23, 59, 59))).toBe('20261026');
  expect(dayStart('20261026')).toBe(Date.UTC(2026, 9, 26));
  expect(nextDay('20261031')).toBe('20261101');
});

test('the pool is shared by fees, and $aura per $1 floats', () => {
  expect(shareOf(100_000, 3, 4)).toBe(75_000);
  expect(shareOf(100_000, 0, 0)).toBe(0);
  // The first fee of a quiet day takes the whole pool; on a busy day the same fee adds little.
  expect(marginalShare(100_000, 0, 0, 0.05)).toBe(100_000);
  expect(marginalShare(100_000, 0, 1_000, 0.05)).toBeCloseTo(4.9998, 3);
  // Adding to your own fees when you're already alone adds nothing.
  expect(marginalShare(100_000, 1, 1, 1)).toBe(0);
});
