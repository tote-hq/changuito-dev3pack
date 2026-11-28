import { rampFromEnv, statusFromBody } from '../../../lib/ramp.ts';
import { getStore } from '../../../lib/store.ts';

/** Returns only a public ramp status. The bearer never leaves the worker. */
export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const row = await getStore().get(id);
  if (!row?.ramp_order_id) return Response.json({ error: 'not_found' }, { status: 404 });
  const status = statusFromBody({ status: await rampFromEnv().readStatus(row.ramp_order_id) });
  if (!status) return Response.json({ error: 'unavailable' }, { status: 502 });
  return Response.json({ status });
}
