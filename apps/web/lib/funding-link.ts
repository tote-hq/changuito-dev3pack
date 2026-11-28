/**
 * The shopper's half of a funding link: the URL, the row, and who may settle.
 * The pay app creates the ramp order. This app only writes the row and,
 * once the program id is set, asks the resolver to settle or refund.
 * The program is not deployed here.
 */

export const FUNDING_CONCEPT = "Pay a friend's supermarket cart";
export const RESOLVER = '5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD';
export const TREASURY = '9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc';
export const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const LINK_TTL_MS = 15 * 60 * 1000;
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export type FundingRow = {
  id: string;
  wallet: string;
  amountArs: number;
  concept: string;
  expiresAt: string;
};

export function amountArsFromCentavos(centavos: number): number {
  return centavos / 100;
}

export function showFundingButton(solanaAddress: string | null, centavos: number): boolean {
  return Boolean(solanaAddress) && centavos > 0;
}

export function newFundingRow(input: { id: string; wallet: string; amountArs: number; now: Date }): FundingRow {
  return {
    id: input.id,
    wallet: input.wallet,
    amountArs: input.amountArs,
    concept: FUNDING_CONCEPT,
    expiresAt: new Date(input.now.getTime() + LINK_TTL_MS).toISOString(),
  };
}

export function fundingUrl(origin: string, row: Pick<FundingRow, 'id' | 'wallet'>): string {
  const root = origin.replace(/\/$/, '');
  const query = new URLSearchParams({ wallet: row.wallet, concept: FUNDING_CONCEPT });
  return `${root}/r/${row.id}?${query.toString()}`;
}

/** A Solana address from a Pollar session, when that session has one. The Stellar address is not it. */
export function solanaAddressFrom(wallet: unknown): string | null {
  if (!wallet || typeof wallet !== 'object') return null;
  const record = wallet as Record<string, unknown>;
  for (const key of ['solanaAddress', 'solana_address']) {
    const value = record[key];
    if (typeof value === 'string' && value.length >= 32) return value;
  }
  const accounts = record.accounts;
  if (!accounts || typeof accounts !== 'object') return null;
  const solana = (accounts as Record<string, unknown>).solana;
  if (typeof solana === 'string' && solana.length >= 32) return solana;
  if (solana && typeof solana === 'object') {
    const address = (solana as { address?: unknown }).address;
    if (typeof address === 'string' && address.length >= 32) return address;
  }
  return null;
}

export function someoneFunded(balanceAtCopy: number | null, balanceNow: number | null): boolean {
  return balanceAtCopy !== null && balanceNow !== null && balanceNow > balanceAtCopy;
}

export type FundWatch = { phase: 'idle' } | { phase: 'watching'; baseline: number } | { phase: 'funded' };

/** A failed balance read must not become zero, or the next poll looks like a payment. */
export function fundWatchAfterCopy(balanceAtCopy: number | null): FundWatch {
  if (balanceAtCopy === null) return { phase: 'idle' };
  return { phase: 'watching', baseline: balanceAtCopy };
}

export function fundWatchOnPoll(watch: FundWatch, balanceNow: number | null): FundWatch {
  if (watch.phase !== 'watching') return watch;
  if (someoneFunded(watch.baseline, balanceNow)) return { phase: 'funded' };
  return watch;
}

/** Sum of parsed USDC ui amounts. A missing or failed body is null, not zero. */
export function usdcFromRpc(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as { result?: { value?: unknown } }).result?.value;
  if (!Array.isArray(value)) return null;
  let total = 0;
  for (const row of value) {
    const amount = (row as { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: unknown } } } } } })
      .account?.data?.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
    total += amount;
  }
  return total;
}

/**
 * Solana secret keys are 64 bytes: the seed, then the public key.
 * The last 32 bytes are the signer. This does not accept a 32-byte seed,
 * because that would hide the public key the settle check has to see.
 */
export function pubkeyFromSolanaSecret(secret: string): string {
  const bytes = base58Decode(secret);
  if (bytes.length !== 64) throw new Error('SOLANA_RESOLVER_SECRET must be a Solana secret key');
  return base58Encode(bytes.subarray(32));
}

/** The resolver may settle. The buyer may not, even if that key is what the env holds. */
export function signerMaySettle(signer: string, buyers: readonly string[]): boolean {
  return signer === RESOLVER && !buyers.includes(signer);
}

export type CloseDecision = 'skip' | 'refuse' | 'send';

export function solanaCloseDecision(
  env: { SOLANA_RESOLVER_SECRET?: string; SOLANA_ESCROW_ID?: string; SOLANA_RPC_URL?: string },
  buyers: readonly string[],
): CloseDecision {
  if (!env.SOLANA_RESOLVER_SECRET || !env.SOLANA_ESCROW_ID || !env.SOLANA_RPC_URL) return 'skip';
  let signer: string;
  try {
    signer = pubkeyFromSolanaSecret(env.SOLANA_RESOLVER_SECRET);
  } catch {
    return 'refuse';
  }
  return signerMaySettle(signer, buyers) ? 'send' : 'refuse';
}

/** Instruction data for the custody program. Tag 0 lock, 1 settle, 2 refund. */
export function lockData(orderId: Uint8Array, amount: bigint, basket: Uint8Array): Uint8Array {
  if (orderId.length !== 32 || basket.length !== 32) throw new Error('order id and basket hash are 32 bytes');
  const data = new Uint8Array(1 + 32 + 8 + 32);
  data[0] = 0;
  data.set(orderId, 1);
  const amountBytes = new Uint8Array(8);
  new DataView(amountBytes.buffer).setBigUint64(0, amount, true);
  data.set(amountBytes, 33);
  data.set(basket, 41);
  return data;
}

export function settleData(): Uint8Array {
  return Uint8Array.of(1);
}

export function refundData(): Uint8Array {
  return Uint8Array.of(2);
}

export function base58Decode(value: string): Uint8Array {
  const bytes = [0];
  for (const char of value) {
    const digit = B58.indexOf(char);
    if (digit < 0) throw new Error('invalid base58');
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of value) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += digits[i]! << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let prefix = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    prefix += '1';
  }
  return prefix + digits.reverse().map((digit) => B58[digit]).join('');
}
