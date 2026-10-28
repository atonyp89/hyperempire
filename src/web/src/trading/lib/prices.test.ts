import { expect, test } from 'bun:test';
import { formatPrice, formatSize } from './prices';

test('prices follow Hyperliquid perp rules: 5 significant figures, at most 6 - szDecimals decimals', () => {
  expect(formatPrice(81179 * 1.03, 5)).toBe('83614');
  expect(formatPrice(2356.8 * 0.97, 4)).toBe('2286.1');
  expect(formatPrice(0.077114 * 1.03, 0)).toBe('0.079427');
  expect(formatPrice(0.006769 * 1.03, 0)).toBe('0.006972');
  expect(formatPrice(101.94, 2)).toBe('101.94');
  expect(formatPrice(123456.7, 5)).toBe('123460');
});

test('sizes round down to szDecimals', () => {
  expect(formatSize(0.0123456, 5)).toBe('0.01234');
  expect(formatSize(12.9, 0)).toBe('12');
});
