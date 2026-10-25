// localStorage helpers. Keys were renamed from the HyperHero / Degen Empire working names to `hyperempire.*`;
// `readMigrating` moves a value saved under an old key so players keep their trading key and progress.

export function readMigrating(key: string, oldKeys: string[]): string | null {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    for (const old of oldKeys) {
      const value = localStorage.getItem(old);
      if (value !== null) {
        localStorage.setItem(key, value);
        localStorage.removeItem(old);
        return value;
      }
    }
  } catch {
    // Storage blocked.
  }
  return null;
}
