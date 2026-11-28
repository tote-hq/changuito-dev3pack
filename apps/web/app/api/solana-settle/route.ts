import { solanaCloseDecision, type CloseDecision } from '../../../lib/funding-link.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolver settle or refund for the Solana vault.
 * A missing program id skips, so checkout still finishes before the deploy.
 * A key that is not the resolver, or that is the buyer, is refused and nothing is sent.
 */
export function closeHttp(decision: CloseDecision): { status: number; body: { skipped?: true; error?: string } } {
  if (decision === 'skip') return { status: 200, body: { skipped: true } };
  if (decision === 'refuse') return { status: 403, body: { error: 'the buyer cannot settle' } };
  return { status: 409, body: { error: 'the custody program is not deployed yet' } };
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { buyers?: unknown } | null;
  const buyers = Array.isArray(body?.buyers) ? body.buyers.filter((item): item is string => typeof item === 'string') : [];
  const http = closeHttp(solanaCloseDecision(process.env, buyers));
  return Response.json(http.body, { status: http.status });
}
