import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { closeHttp } from '../../app/api/solana-settle/route.ts';
import {
  FUNDING_CONCEPT,
  RESOLVER,
  amountArsFromCentavos,
  base58Decode,
  base58Encode,
  fundingUrl,
  lockData,
  newFundingRow,
  pubkeyFromSolanaSecret,
  refundData,
  settleData,
  showFundingButton,
  signerMaySettle,
  solanaAddressFrom,
  solanaCloseDecision,
  someoneFunded,
  usdcFromRpc,
} from '../funding-link.ts';

const WALLET = '57NLdwkHrqRrmydcVzWLQup4D5yRuC6W4MHqYeuYUgFi';

describe('funding link', () => {
  it('copies a url with the wallet and the fixed concept, and no amount', () => {
    const row = newFundingRow({
      id: '6b1b3a0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      wallet: WALLET,
      amountArs: 12000,
      now: new Date('2026-11-28T12:00:00.000Z'),
    });
    assert.equal(row.concept, FUNDING_CONCEPT);
    assert.equal(row.expiresAt, '2026-11-28T12:15:00.000Z');
    assert.equal(amountArsFromCentavos(1_200_000), 12000);
    const url = new URL(fundingUrl('https://pay.changuito.me/', row));
    assert.equal(url.origin + url.pathname, 'https://pay.changuito.me/r/6b1b3a0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
    assert.equal(url.searchParams.get('wallet'), WALLET);
    assert.equal(url.searchParams.get('concept'), FUNDING_CONCEPT);
    assert.equal(url.searchParams.get('amount'), null);
    assert.equal(url.searchParams.get('products'), null);
  });

  it('shows the button only with a Solana address and a total', () => {
    assert.equal(showFundingButton(WALLET, 100), true);
    assert.equal(showFundingButton(null, 100), false);
    assert.equal(showFundingButton(WALLET, 0), false);
  });

  it('reads a Solana address from the session and ignores a Stellar one', () => {
    assert.equal(solanaAddressFrom({ address: 'G' + 'A'.repeat(55) }), null);
    assert.equal(solanaAddressFrom({ solanaAddress: WALLET }), WALLET);
    assert.equal(solanaAddressFrom({ accounts: { solana: { address: WALLET } } }), WALLET);
  });

  it('says the cart was funded only when the balance rose', () => {
    assert.equal(someoneFunded(1, 1.5), true);
    assert.equal(someoneFunded(1, 1), false);
    assert.equal(someoneFunded(null, 1), false);
  });

  it('parses a token balance and treats a failed body as unknown', () => {
    assert.equal(usdcFromRpc({ result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: 2 } } } } } }] } }), 2);
    assert.equal(usdcFromRpc({ error: 'nope' }), null);
  });
});

describe('solana settle', () => {
  it('lets the resolver settle and refuses the buyer', () => {
    assert.equal(signerMaySettle(RESOLVER, [WALLET]), true);
    assert.equal(signerMaySettle(WALLET, [WALLET]), false);
    assert.equal(signerMaySettle(RESOLVER, [RESOLVER]), false);
  });

  it('skips until the program is configured, then refuses a buyer key', () => {
    assert.equal(solanaCloseDecision({}, [WALLET]), 'skip');
    const pub = base58Decode(RESOLVER);
    assert.equal(pub.length, 32);
    const secretBytes = new Uint8Array(64);
    secretBytes.set(pub, 32);
    const secret = base58Encode(secretBytes);
    assert.equal(pubkeyFromSolanaSecret(secret), RESOLVER);
    const env = { SOLANA_RESOLVER_SECRET: secret, SOLANA_ESCROW_ID: 'prog', SOLANA_RPC_URL: 'https://rpc' };
    assert.equal(solanaCloseDecision(env, [WALLET]), 'send');
    const buyerBytes = new Uint8Array(64);
    buyerBytes.set(base58Decode(WALLET), 32);
    const buyerSecret = base58Encode(buyerBytes);
    assert.equal(
      solanaCloseDecision({ ...env, SOLANA_RESOLVER_SECRET: buyerSecret }, [WALLET]),
      'refuse',
    );
  });

  it('lock, settle and refund use the program tags', () => {
    const data = lockData(new Uint8Array(32).fill(3), 1_500_000n, new Uint8Array(32).fill(9));
    assert.equal(data[0], 0);
    assert.equal(data.length, 73);
    assert.equal(settleData()[0], 1);
    assert.equal(refundData()[0], 2);
  });

  it('does not send when the signer is the buyer', () => {
    assert.equal(closeHttp('refuse').status, 403);
    assert.equal(closeHttp('skip').status, 200);
    assert.equal(closeHttp('skip').body.skipped, true);
  });
});
