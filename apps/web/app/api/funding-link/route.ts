import { randomUUID } from 'node:crypto';

import { db, hasDatabase } from '../../../lib/db.ts';
import { base58Decode, fundingUrl, newFundingRow } from '../../../lib/funding-link.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Writes the funding row and returns the link the shopper copies. */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { wallet?: unknown; amountArs?: unknown } | null;
  const wallet = typeof body?.wallet === 'string' ? body.wallet : '';
  const amountArs = typeof body?.amountArs === 'number' ? body.amountArs : Number.NaN;
  let key: Uint8Array;
  try {
    key = base58Decode(wallet);
  } catch {
    key = new Uint8Array();
  }
  if (key.length !== 32 || !Number.isFinite(amountArs) || amountArs <= 0) {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  if (!hasDatabase()) return Response.json({ error: 'unavailable' }, { status: 503 });

  const row = newFundingRow({ id: randomUUID(), wallet, amountArs, now: new Date() });
  await db()`
    insert into funding_request (id, wallet, amount_ars, concept, expires_at, status)
    values (${row.id}, ${row.wallet}, ${row.amountArs}, ${row.concept}, ${row.expiresAt}, 'open')
  `;
  const origin = process.env.NEXT_PUBLIC_PAY_ORIGIN || 'https://pay.changuito.me';
  return Response.json({ url: fundingUrl(origin, row) });
}
