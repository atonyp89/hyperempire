// Signing in to the HyperEmpire API with the connected wallet: one signature per wallet and network, then a
// session token (kept in this browser) on every call. Shared by every screen through a tiny store.

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useSignMessage } from 'wagmi';
import type { MeView, NonceResponse, SessionResponse } from '@server/contract';
import { api, ApiRequestError } from './api';
import { NETWORK } from './network';

type Saved = { token: string; expiresAt: number };

const keyFor = (address: string) => `hyperempire.session.${NETWORK}.${address.toLowerCase()}`;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(address: string | undefined): Saved | null {
  if (!address) return null;
  try {
    const raw = localStorage.getItem(keyFor(address));
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function write(address: string, s: Saved | null) {
  try {
    if (s) localStorage.setItem(keyFor(address), JSON.stringify(s));
    else localStorage.removeItem(keyFor(address));
  } catch {
    // Storage blocked: the session lasts for this visit only.
  }
  notify();
}

/** Forget the session after the server rejected it (expired or revoked), so the UI asks to sign in again. */
export function dropSession(address: string | undefined) {
  if (address) write(address, null);
}

export function useSession() {
  const { address } = useConnection();
  const token = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => read(address)?.token ?? null,
  );
  const { mutateAsync: signMessage } = useSignMessage();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address) return;
    setSigningIn(true);
    setError(null);
    try {
      const n = await api<NonceResponse>('/auth/nonce', { body: { address } });
      const signature = await signMessage({ message: n.message });
      const s = await api<SessionResponse>('/auth/verify', { body: { address, nonce: n.nonce, signature } });
      write(address, { token: s.token, expiresAt: s.expiresAt });
    } catch (err) {
      setError(err instanceof ApiRequestError || err instanceof Error ? (err as Error).message.split('\n')[0] : 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }, [address, signMessage]);

  const signOut = useCallback(async () => {
    if (!address) return;
    const t = read(address)?.token;
    write(address, null);
    if (t) await api('/auth/sign-out', { method: 'POST', token: t }).catch(() => undefined);
  }, [address]);

  /** Call the API as the signed-in player. A 401 means the session ended, so it is dropped and sign-in shows again. */
  const call = useCallback(
    async <T>(path: string, opts: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> => {
      try {
        return await api<T>(path, { ...opts, token });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) dropSession(address);
        throw err;
      }
    },
    [address, token],
  );

  return { address, token, signedIn: !!token, signIn, signingIn, error, signOut, call };
}

/** The signed-in player's $aura and Townhall basics, refreshed every 30 s (each read also credits new fees). */
export function useMe() {
  const s = useSession();
  return useQuery({
    queryKey: ['me', NETWORK, s.address?.toLowerCase()],
    enabled: s.signedIn,
    queryFn: () => s.call<MeView>('/me'),
    refetchInterval: 30_000,
  });
}
