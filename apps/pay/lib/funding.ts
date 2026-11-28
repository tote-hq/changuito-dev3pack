import type { OrderResult, PublicStatus, QuoteResult, Ramp } from './ramp.ts';

export const CONCEPT = "Pay a friend's supermarket cart";
/** One sandbox order cannot buy more than this many USDC. */
export const USDC_CAP = 5;

export type Row = {
  id: string;
  wallet: string;
  amount_ars: number;
  concept: string;
  expires_at: string;
  ramp_order_id: string | null;
  ramp_link: string | null;
  quoted_usdc: number | null;
  status: string;
};

export type Patch = {
  ramp_order_id: string;
  ramp_link: string;
  quoted_usdc: number;
  status: PublicStatus;
};

export type View =
  | { kind: 'missing' }
  | { kind: 'mismatch' }
  | { kind: 'expired' }
  | { kind: 'over_limit' }
  | { kind: 'unavailable' }
  | {
      kind: 'pay';
      concept: string;
      amountArs: number;
      quotedUsdc: number;
      link: string;
      status: string;
      orderId: string;
    };

export type Opened = { view: View; patch: Patch | null };

/**
 * Decides what the payer sees. The amount and the wallet come from the row.
 * The query wallet has to match, so a rewritten link cannot pay a different address.
 * The stored concept is what the page shows.
 */
export async function openFunding(row: Row | null, queryWallet: string, now: Date, ramp: Ramp): Promise<Opened> {
  if (!row) return { view: { kind: 'missing' }, patch: null };
  if (!queryWallet || queryWallet !== row.wallet) return { view: { kind: 'mismatch' }, patch: null };
  if (row.ramp_order_id) return { view: payView(row), patch: null };
  if (now.getTime() > Date.parse(row.expires_at)) return { view: { kind: 'expired' }, patch: null };

  const quote: QuoteResult = await ramp.quote(row.amount_ars);
  if (!quote.ok) {
    if (quote.reason === 'too_large' || quote.reason === 'no_liquidity') {
      return { view: { kind: 'over_limit' }, patch: null };
    }
    return { view: { kind: 'unavailable' }, patch: null };
  }
  if (quote.usdc > USDC_CAP) return { view: { kind: 'over_limit' }, patch: null };

  const order: OrderResult = await ramp.createOrder({
    amountUsdc: quote.usdc,
    wallet: row.wallet,
    idempotencyKey: row.id,
  });
  if (!order.ok) return { view: { kind: 'unavailable' }, patch: null };

  const patch: Patch = {
    ramp_order_id: order.id,
    ramp_link: order.link,
    quoted_usdc: quote.usdc,
    status: order.status,
  };
  return {
    view: {
      kind: 'pay',
      concept: row.concept,
      amountArs: row.amount_ars,
      quotedUsdc: quote.usdc,
      link: order.link,
      status: order.status,
      orderId: order.id,
    },
    patch,
  };
}

function payView(row: Row): View {
  if (!row.ramp_order_id || !row.ramp_link || row.quoted_usdc === null) return { kind: 'unavailable' };
  return {
    kind: 'pay',
    concept: row.concept,
    amountArs: row.amount_ars,
    quotedUsdc: row.quoted_usdc,
    link: row.ramp_link,
    status: row.status,
    orderId: row.ramp_order_id,
  };
}

export function statusCopy(status: string): string {
  if (status === 'completed') return 'The payment is in. You can close this window.';
  if (status === 'received') return 'Transfer received.';
  if (status === 'paying') return 'Sending USDC.';
  if (status === 'error' || status === 'refunded' || status === 'expired') return 'The payment did not complete.';
  return 'Waiting for the transfer.';
}
