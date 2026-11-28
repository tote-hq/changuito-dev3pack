import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONCEPT, openFunding, statusCopy, type Row } from '../funding.ts';
import { orderBody, parseQuote, publicStatus, quoteBody, rampFromEnv, statusFromBody } from '../ramp.ts';
import type { Ramp } from '../ramp.ts';

const WALLET = '57NLdwkHrqRrmydcVzWLQup4D5yRuC6W4MHqYeuYUgFi';

function row(over: Partial<Row> = {}): Row {
  return {
    id: '6b1b3a0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    wallet: WALLET,
    amount_ars: 12000,
    concept: CONCEPT,
    expires_at: '2026-11-28T12:15:00.000Z',
    ramp_order_id: null,
    ramp_link: null,
    quoted_usdc: null,
    status: 'open',
    ...over,
  };
}

function ramp(over: Partial<Ramp> = {}): Ramp & { orders: number } {
  const state = { orders: 0 };
  return {
    get orders() {
      return state.orders;
    },
    async quote() {
      return { ok: true, usdc: 2 };
    },
    async createOrder(input) {
      state.orders += 1;
      assert.equal(input.wallet, WALLET);
      assert.equal(input.idempotencyKey, row().id);
      assert.equal(input.amountUsdc, 2);
      return { ok: true, id: 'ord_1', link: 'https://sandbox.example/pay', status: 'awaiting_transfer' };
    },
    async readStatus() {
      return 'completed';
    },
    ...over,
  } as Ramp & { orders: number };
}

const now = new Date('2026-11-28T12:00:00.000Z');

test('a different wallet is refused and no order is created', async () => {
  const client = ramp();
  const opened = await openFunding(row(), 'other-wallet', now, client);
  assert.deepEqual(opened, { view: { kind: 'mismatch' }, patch: null });
  assert.equal(client.orders, 0);
});

test('an expired link with no order does not quote', async () => {
  let quoted = 0;
  const client = ramp({
    async quote() {
      quoted += 1;
      return { ok: true, usdc: 1 };
    },
  });
  const opened = await openFunding(row(), WALLET, new Date('2026-11-28T12:16:00.000Z'), client);
  assert.equal(opened.view.kind, 'expired');
  assert.equal(quoted, 0);
});

test('an order created before expiry can still be shown', async () => {
  const opened = await openFunding(
    row({
      ramp_order_id: 'ord_1',
      ramp_link: 'https://sandbox.example/pay',
      quoted_usdc: 2,
      status: 'paying',
    }),
    WALLET,
    new Date('2026-11-28T13:00:00.000Z'),
    ramp(),
  );
  assert.equal(opened.view.kind, 'pay');
  if (opened.view.kind === 'pay') assert.equal(opened.view.status, 'paying');
  assert.equal(opened.patch, null);
});

test('a quote over 5 USDC does not create an order', async () => {
  const client = ramp({
    async quote() {
      return { ok: true, usdc: 5.01 };
    },
  });
  const opened = await openFunding(row(), WALLET, now, client);
  assert.equal(opened.view.kind, 'over_limit');
  assert.equal(client.orders, 0);
});

test('too_large and no_liquidity do not create an order', async () => {
  for (const reason of ['too_large', 'no_liquidity'] as const) {
    const client = ramp({
      async quote() {
        return { ok: false, reason };
      },
    });
    const opened = await openFunding(row(), WALLET, now, client);
    assert.equal(opened.view.kind, 'over_limit');
    assert.equal(client.orders, 0);
  }
});

test('the first open creates one order and the next open does not', async () => {
  const client = ramp();
  const first = await openFunding(row(), WALLET, now, client);
  assert.equal(first.patch?.ramp_order_id, 'ord_1');
  assert.equal(first.patch?.quoted_usdc, 2);
  const stored = row({
    ramp_order_id: first.patch!.ramp_order_id,
    ramp_link: first.patch!.ramp_link,
    quoted_usdc: first.patch!.quoted_usdc,
    status: first.patch!.status,
  });
  const second = await openFunding(stored, WALLET, now, client);
  assert.equal(second.patch, null);
  assert.equal(client.orders, 1);
});

test('quote and order bodies match the ramp contract', () => {
  assert.deepEqual(quoteBody(12000), {
    direction: 'onramp',
    fiat: 'ARS',
    amount: 12000,
    denomination: 'fiat',
  });
  assert.equal(orderBody({ amountUsdc: 2, wallet: WALLET, idempotencyKey: 'row' }).idempotency_key, 'row');
  assert.equal(orderBody({ amountUsdc: 2, wallet: WALLET, idempotencyKey: 'row' }).wallet, WALLET);
});

test('unknown ramp statuses are not shown', () => {
  assert.equal(publicStatus('completed'), 'completed');
  assert.equal(publicStatus('internal_review'), null);
  assert.equal(statusFromBody({ status: 'completed', link: 'https://secret' }), 'completed');
  assert.equal(statusFromBody({ status: 'nope' }), null);
  assert.equal(parseQuote(400, { error: 'too_large' }).ok, false);
});

test('the worker sends the bearer and returns no token', async () => {
  let auth = '';
  const client = rampFromEnv({ SANDBOX_RAMP_TOKEN: 'sec_testnet_hidden' }, async (_url, init) => {
    auth = String((init?.headers as Record<string, string>).authorization);
    return new Response(JSON.stringify({ usdc: 1.5 }), { status: 200 });
  });
  const quote = await client.quote(1000);
  assert.equal(auth, 'Bearer sec_testnet_hidden');
  assert.deepEqual(quote, { ok: true, usdc: 1.5 });
  assert.equal(JSON.stringify(quote).includes('sec_testnet_hidden'), false);
});

test('a missing token does not call the ramp', async () => {
  let called = 0;
  const client = rampFromEnv({}, async () => {
    called += 1;
    return new Response('{}');
  });
  const quote = await client.quote(1000);
  assert.deepEqual(quote, { ok: false, reason: 'unavailable' });
  assert.equal(called, 0);
});

test('completed copy tells the payer they can close the window', () => {
  assert.match(statusCopy('completed'), /close this window/);
  assert.match(statusCopy('awaiting_transfer'), /Waiting/);
});
