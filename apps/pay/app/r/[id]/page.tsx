import { openFunding } from '../../../lib/funding.ts';
import { rampFromEnv } from '../../../lib/ramp.ts';
import { getStore } from '../../../lib/store.ts';
import { StatusLine } from './status.tsx';

export default async function FundingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wallet?: string }>;
}) {
  const { id } = await params;
  const { wallet = '' } = await searchParams;
  if (!process.env.DATABASE_URL) {
    return (
      <main>
        <h1>Unavailable</h1>
        <p>The payment service is unavailable. Nothing was charged.</p>
      </main>
    );
  }
  const store = getStore();
  const row = await store.get(id);
  const opened = await openFunding(row, wallet, new Date(), rampFromEnv());
  if (opened.patch) await store.save(id, opened.patch);
  const view = opened.view;

  if (view.kind === 'missing') {
    return (
      <main>
        <h1>Link not found</h1>
        <p>This funding link does not exist.</p>
      </main>
    );
  }
  if (view.kind === 'mismatch') {
    return (
      <main>
        <h1>Link refused</h1>
        <p>This link does not match the cart.</p>
      </main>
    );
  }
  if (view.kind === 'expired') {
    return (
      <main>
        <h1>Link expired</h1>
        <p>This link has expired.</p>
      </main>
    );
  }
  if (view.kind === 'over_limit') {
    return (
      <main>
        <h1>Over the demo limit</h1>
        <p>This cart is over the demo limit, so no payment was started.</p>
      </main>
    );
  }
  if (view.kind === 'unavailable') {
    return (
      <main>
        <h1>Unavailable</h1>
        <p>The payment service is unavailable. Nothing was charged.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{view.concept}</h1>
      <p>Total: ARS {view.amountArs}</p>
      <p>Quoted: {view.quotedUsdc} USDC</p>
      <p>
        <a className="pay-link" href={view.link} target="_blank" rel="noopener noreferrer">
          Simulate transfer
        </a>
      </p>
      <StatusLine id={id} initial={view.status} />
    </main>
  );
}
