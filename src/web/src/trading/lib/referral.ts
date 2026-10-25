// Creator referral codes: captured from `?ref=CODE` and kept for the session's wallet.
// Attribution itself (fee share paid in USDC) is recorded server-side; this only remembers the code.

import { readMigrating } from '../../shared/storage';

const KEY = 'hyperempire.ref';
const VALID = /^[A-Za-z0-9_-]{2,32}$/;

export function captureReferral(): string | null {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code && VALID.test(code)) localStorage.setItem(KEY, code.toUpperCase());
    return readMigrating(KEY, ['hyperhero.ref']);
  } catch {
    return null;
  }
}
