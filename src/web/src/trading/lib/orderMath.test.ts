import { describe, expect, test } from 'bun:test';
import { estLiquidationPx, estSlippage, priceForRoe, roeForPrice } from './orderMath';

describe('priceForRoe / roeForPrice', () => {
  test('long take profit sits above the entry, stop loss below', () => {
    expect(priceForRoe(100, 50, 10, true, 'tp')).toBeCloseTo(105);
    expect(priceForRoe(100, 20, 10, true, 'sl')).toBeCloseTo(98);
  });
  test('short is mirrored', () => {
    expect(priceForRoe(100, 50, 10, false, 'tp')).toBeCloseTo(95);
    expect(priceForRoe(100, 20, 10, false, 'sl')).toBeCloseTo(102);
  });
  test('round trip', () => {
    expect(roeForPrice(100, priceForRoe(100, 37, 5, true, 'tp'), 5)).toBeCloseTo(37);
  });
});

describe('estLiquidationPx', () => {
  const base = { px: 100, size: 1, leverage: 10, maxLeverage: 50, isCross: false, freeUsd: 0 };
  test('isolated long: 10% margin minus 1% maintenance', () => {
    expect(estLiquidationPx({ ...base, isLong: true })).toBeCloseTo(91);
  });
  test('isolated short mirrors it', () => {
    expect(estLiquidationPx({ ...base, isLong: false })).toBeCloseTo(109);
  });
  test('cross adds free collateral, pushing liquidation further out', () => {
    expect(estLiquidationPx({ ...base, isLong: true, isCross: true, freeUsd: 40 })).toBeCloseTo(51);
  });
  test('no size, no price', () => {
    expect(estLiquidationPx({ ...base, size: 0, isLong: true })).toBeNull();
  });
});

describe('estSlippage', () => {
  const asks = [
    { px: 101, sz: 1 },
    { px: 102, sz: 2 },
  ];
  test('walks the book', () => {
    const r = estSlippage(asks, 2, 100)!;
    expect(r.avgPx).toBeCloseTo(101.5);
    expect(r.pct).toBeCloseTo(1.5);
  });
  test('too thin', () => {
    expect(estSlippage(asks, 5, 100)).toBeNull();
  });
});
