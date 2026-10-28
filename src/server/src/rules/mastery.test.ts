import { expect, test } from 'bun:test';
import { countedFee, discountedFeeTenths, feeDiscount, fillWeight, masteryLevel, xpForLevel, xpToNext } from './mastery';

test('the curve: 100 × n² per level, Mastery 25 at 490,000 XP (~$10M volume at 0.05%)', () => {
  expect(xpToNext(1)).toBe(100);
  expect(xpForLevel(1)).toBe(0);
  expect(xpForLevel(2)).toBe(100);
  expect(xpForLevel(25)).toBe(490_000);
  expect(masteryLevel(0, 10)).toMatchObject({ level: 1, uncapped: 1, xpIntoLevel: 0, xpForNext: 100 });
  expect(masteryLevel(490_000, 99)).toMatchObject({ level: 25, uncapped: 25 });
  // Capped by the Townhall; the XP isn't lost.
  expect(masteryLevel(490_000, 7)).toMatchObject({ level: 7, uncapped: 25 });
});

test('Lower fees: −2% per rank, in whole tenths of a basis point', () => {
  expect(feeDiscount({ 'lower-fees': 10 })).toBeCloseTo(0.2);
  expect(discountedFeeTenths(50, {})).toBe(50);
  expect(discountedFeeTenths(50, { 'lower-fees': 3 })).toBe(47);
  expect(discountedFeeTenths(50, { 'lower-fees': 10 })).toBe(40);
});

test('a fill counts its list-rate fee when the discount was earned, and less when it was faked', () => {
  const list = 0.0005; // $100 trade: $0.05 at list
  expect(countedFee(50_000, 100_000_000, list, {})).toBe(50_000);
  // Earned −20%: paid $0.04, counts the full $0.05.
  expect(countedFee(40_000, 100_000_000, list, { 'lower-fees': 10 })).toBeCloseTo(50_000);
  // No discount earned but paid $0.02 (a modified client): counts $0.02.
  expect(countedFee(20_000, 100_000_000, list, {})).toBe(20_000);
  // Never more than the list-rate fee.
  expect(countedFee(90_000, 100_000_000, list, {})).toBe(50_000);
  // Rows from before Mastery (no trade size) count as paid.
  expect(countedFee(30_000, null, list, {})).toBe(30_000);
});

test('pool weight: Market maker on maker fills, Taker on taker fills, Whale on big days', () => {
  const ranks = { 'market-maker': 5, taker: 2, whale: 5 };
  expect(fillWeight(100, false, ranks, false)).toBeCloseTo(115);
  expect(fillWeight(100, true, ranks, false)).toBeCloseTo(106);
  expect(fillWeight(100, false, ranks, true)).toBeCloseTo(130);
  expect(fillWeight(100, null, ranks, false)).toBe(100);
});
