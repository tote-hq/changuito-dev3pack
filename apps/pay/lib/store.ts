import postgres from 'postgres';

import type { Patch, Row } from './funding.ts';

export interface FundingStore {
  get(id: string): Promise<Row | null>;
  save(id: string, patch: Patch): Promise<void>;
}

export function memoryStore(seed: Row[] = []): FundingStore {
  const rows = new Map(seed.map((row) => [row.id, row]));
  return {
    async get(id) {
      return rows.get(id) ?? null;
    },
    async save(id, patch) {
      const row = rows.get(id);
      if (!row) return;
      rows.set(id, { ...row, ...patch });
    },
  };
}

export function rowFromDb(raw: Record<string, unknown>): Row {
  return {
    id: String(raw.id),
    wallet: String(raw.wallet),
    amount_ars: Number(raw.amount_ars),
    concept: String(raw.concept),
    expires_at: new Date(String(raw.expires_at)).toISOString(),
    ramp_order_id: raw.ramp_order_id == null ? null : String(raw.ramp_order_id),
    ramp_link: raw.ramp_link == null ? null : String(raw.ramp_link),
    quoted_usdc: raw.quoted_usdc == null ? null : Number(raw.quoted_usdc),
    status: String(raw.status),
  };
}

let cached: ReturnType<typeof postgres> | undefined;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) cached = postgres(url, { prepare: false, max: 1 });
  return cached;
}

export function dbStore(): FundingStore {
  return {
    async get(id) {
      const db = sql();
      if (!db) return null;
      const rows = await db<Record<string, unknown>[]>`
        select id, wallet, amount_ars, concept, expires_at, ramp_order_id, ramp_link, quoted_usdc, status
        from funding_request where id = ${id}
      `;
      const row = rows[0];
      return row ? rowFromDb(row) : null;
    },
    async save(id, patch) {
      const db = sql();
      if (!db) return;
      await db`
        update funding_request set
          ramp_order_id = ${patch.ramp_order_id},
          ramp_link = ${patch.ramp_link},
          quoted_usdc = ${patch.quoted_usdc},
          status = ${patch.status}
        where id = ${id} and ramp_order_id is null
      `;
    },
  };
}

/** Postgres when the worker has a database. Otherwise an empty memory map. */
export function getStore(): FundingStore {
  return process.env.DATABASE_URL ? dbStore() : memoryStore();
}
