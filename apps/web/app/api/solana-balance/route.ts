import { USDC_MINT, usdcFromRpc } from '../../../lib/funding-link.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The shopper's Solana USDC balance. The browser does not talk to the RPC. */
export async function GET(req: Request): Promise<Response> {
  const wallet = new URL(req.url).searchParams.get('wallet') ?? '';
  const rpc = process.env.SOLANA_RPC_URL;
  if (!wallet || !rpc) return Response.json({ usdc: null });
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [wallet, { mint: USDC_MINT }, { encoding: 'jsonParsed' }],
    }),
  });
  const body = await res.json().catch(() => null);
  return Response.json({ usdc: usdcFromRpc(body) });
}
