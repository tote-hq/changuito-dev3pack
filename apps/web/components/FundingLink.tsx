'use client';

import { useEffect, useState } from 'react';

import { fundWatchAfterCopy, fundWatchOnPoll, showFundingButton, type FundWatch } from '../lib/funding-link.ts';
import { uiCopy } from '../lib/ui-copy.ts';
import { useWallet } from '../lib/use-wallet.ts';
import { useLang } from './LangProvider';

const BASELINE = 'chg_fund_baseline';

/**
 * Secondary cart action. It writes the funding row and copies the pay link.
 * The funded line is cart copy, not an agent message.
 */
export function FundingLink({ centavos }: { centavos: number }) {
  const wallet = useWallet();
  const copy = uiCopy(useLang()).cart;
  const address = wallet.solanaAddress ?? null;
  const [watch, setWatch] = useState<FundWatch>({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const funded = watch.phase === 'funded';

  useEffect(() => {
    if (!address) return;
    const raw = sessionStorage.getItem(`${BASELINE}:${address}`);
    if (raw === null) return;
    const baseline = Number(raw);
    if (Number.isFinite(baseline)) setWatch({ phase: 'watching', baseline });
  }, [address]);

  useEffect(() => {
    if (!address || watch.phase !== 'watching') return;
    const baseline = watch.baseline;
    const timer = setInterval(() => {
      void fetch(`/api/solana-balance?wallet=${encodeURIComponent(address)}`)
        .then((res) => res.json())
        .then((body: { usdc?: number | null }) => {
          const usdc = typeof body.usdc === 'number' ? body.usdc : null;
          setWatch((current) => fundWatchOnPoll(current, usdc));
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [address, watch]);

  if (!showFundingButton(address, centavos) && !funded) return null;

  async function copy() {
    if (!address) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/funding-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: address, amountArs: centavos / 100 }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'link failed');
      await navigator.clipboard.writeText(json.url);
      const balance = await fetch(`/api/solana-balance?wallet=${encodeURIComponent(address)}`)
        .then((r) => r.json())
        .then((body: { usdc?: number | null }) => (typeof body.usdc === 'number' ? body.usdc : null))
        .catch(() => null);
      const next = fundWatchAfterCopy(balance);
      setWatch(next);
      if (next.phase === 'watching') sessionStorage.setItem(`${BASELINE}:${address}`, String(next.baseline));
      setNote(json.url);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'link failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {funded ? (
        <p data-testid="funded-line" role="status">
          {copy.fundedLine}
        </p>
      ) : null}
      {showFundingButton(address, centavos) ? (
        <button
          type="button"
          className="btn btn-ghost"
          data-testid="copy-funding-link"
          style={{ minHeight: 44, minWidth: 44 }}
          disabled={busy}
          onClick={() => void copy()}
        >
          {copy.fundingCta}
        </button>
      ) : null}
      {note ? <p className="cart-warn">{note}</p> : null}
    </>
  );
}
