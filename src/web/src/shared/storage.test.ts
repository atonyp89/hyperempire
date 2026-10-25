import { beforeEach, expect, test } from 'bun:test';
import { readMigrating } from './storage';

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
});

test('moves a value from an old key to the new one', () => {
  localStorage.setItem('hyperhero.ref', 'ALICE');
  expect(readMigrating('hyperempire.ref', ['hyperhero.ref'])).toBe('ALICE');
  expect(localStorage.getItem('hyperempire.ref')).toBe('ALICE');
  expect(localStorage.getItem('hyperhero.ref')).toBeNull();
});

test('prefers the new key and returns null when nothing is saved', () => {
  localStorage.setItem('hyperempire.ref', 'NEW');
  localStorage.setItem('hyperhero.ref', 'OLD');
  expect(readMigrating('hyperempire.ref', ['hyperhero.ref'])).toBe('NEW');
  expect(readMigrating('missing', ['also-missing'])).toBeNull();
});
