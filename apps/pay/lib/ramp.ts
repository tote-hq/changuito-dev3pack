/** HTTP shape for the Pollar sandbox ramp. The token stays in the worker. */

export const RAMP_ORIGIN = 'https://sandbox-anchor.pollar.xyz';

export const PUBLIC_STATUSES = [
  'awaiting_transfer',
  'received',
  'paying',
  'completed',
  'error',
  'refunded',
  'expired',
] as const;

export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

export type QuoteResult =
  | { ok: true; usdc: number }
  | { ok: false; reason: 'too_large' | 'no_liquidity' | 'unavailable' };

export type OrderResult =
  | { ok: true; id: string; link: string; status: PublicStatus }
  | { ok: false; reason: 'unavailable' };

export interface Ramp {
  quote(amountArs: number): Promise<QuoteResult>;
  createOrder(input: { amountUsdc: number; wallet: string; idempotencyKey: string }): Promise<OrderResult>;
  readStatus(orderId: string): Promise<PublicStatus | null>;
}

export function quoteBody(amountArs: number): Record<string, unknown> {
  return { direction: 'onramp', fiat: 'ARS', amount: amountArs, denomination: 'fiat' };
}

export function orderBody(input: { amountUsdc: number; wallet: string; idempotencyKey: string }): Record<string, unknown> {
  return {
    direction: 'onramp',
    fiat: 'ARS',
    amount: input.amountUsdc,
    denomination: 'crypto',
    wallet: input.wallet,
    idempotency_key: input.idempotencyKey,
  };
}

export function publicStatus(raw: string): PublicStatus | null {
  return (PUBLIC_STATUSES as readonly string[]).includes(raw) ? (raw as PublicStatus) : null;
}

export function parseQuote(status: number, body: unknown): QuoteResult {
  const reason = errorReason(body);
  if (reason === 'too_large' || reason === 'no_liquidity') return { ok: false, reason };
  if (status < 200 || status >= 300) return { ok: false, reason: 'unavailable' };
  const usdc = numberField(body, ['usdc', 'amount_out', 'crypto_amount', 'destination_amount']);
  if (usdc === null || usdc <= 0) return { ok: false, reason: 'unavailable' };
  return { ok: true, usdc };
}

export function parseOrder(status: number, body: unknown): OrderResult {
  if (status < 200 || status >= 300 || !body || typeof body !== 'object') {
    return { ok: false, reason: 'unavailable' };
  }
  const record = body as Record<string, unknown>;
  const id = stringField(record, ['id', 'order_id']);
  const link = stringField(record, ['link', 'payment_link', 'url']);
  const raw = stringField(record, ['status']) ?? 'awaiting_transfer';
  const mapped = publicStatus(raw) ?? 'awaiting_transfer';
  if (!id || !link) return { ok: false, reason: 'unavailable' };
  return { ok: true, id, link, status: mapped };
}

export function statusFromBody(body: unknown): PublicStatus | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { status?: unknown }).status;
  return typeof raw === 'string' ? publicStatus(raw) : null;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Builds the ramp client. A missing token fails closed and never calls out. */
export function rampFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: FetchLike = fetch): Ramp {
  const token = env.SANDBOX_RAMP_TOKEN;

  async function call(path: string, init?: RequestInit): Promise<{ status: number; body: unknown } | null> {
    if (!token) return null;
    const res = await fetchImpl(`${RAMP_ORIGIN}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  return {
    async quote(amountArs) {
      const res = await call('/api/ramp/v1/quotes', {
        method: 'POST',
        body: JSON.stringify(quoteBody(amountArs)),
      });
      if (!res) return { ok: false, reason: 'unavailable' };
      return parseQuote(res.status, res.body);
    },
    async createOrder(input) {
      const res = await call('/api/ramp/v1/orders', {
        method: 'POST',
        body: JSON.stringify(orderBody(input)),
      });
      if (!res) return { ok: false, reason: 'unavailable' };
      return parseOrder(res.status, res.body);
    },
    async readStatus(orderId) {
      const res = await call(`/api/ramp/v1/orders/${encodeURIComponent(orderId)}`);
      if (!res) return null;
      return statusFromBody(res.body);
    },
  };
}

function errorReason(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const raw = record.error ?? record.code ?? record.reason;
  return typeof raw === 'string' ? raw : null;
}

function numberField(body: unknown, keys: string[]): number | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}
