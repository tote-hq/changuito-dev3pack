---
name: integrators
description: Uses the Supabase, Cloudflare, and Railway MCP servers to debug or configure those hosts. Use when the user mentions Supabase, Cloudflare, Workers, Railway, logs, env vars, deploys, SQL, or a production bug on those platforms.
---

# Integrators

When the work is on Supabase, Cloudflare, or Railway, use that host's MCP. Do not start with `curl` against their APIs. Discover the tool schema with the dynamic tool catalog before the first call.

| Host | Namespace | Start with |
|---|---|---|
| Supabase | `user-Supabase` | `list_projects`, then `list_tables` / `get_advisors` / `query_logs` before any change |
| Cloudflare | `user-cloudflare` | `whoami`, then `search` or `docs`, then `execute` |
| Railway | `plugin-railway-railway` | `whoami`, `list-projects`, then logs, variables, or status |

If a Cloudflare task is a local worker and the repo has a Wrangler config, follow that config. If it does not, the `cf` CLI is the local tool. The MCP is still the way to read the account.

## How to call

1. Read the schema for that tool.
2. Read before write. Say what the live value is before changing it.
3. A secret from an env list is masked on purpose. Do not ask the tool to print it back, and do not paste it into the repo.
4. Confirm with the user before a destructive or billing call: dropping a table, `apply_migration` on a remote project, deleting a Railway service, `accept-deploy`, replacing a variable set, or anything that cuts traffic.

## Which host

- App data, orders, funding rows, auth records: Supabase (`supabase/migrations/` in this repo).
- The running web app, workers, DNS, caches: Cloudflare.
- A service that is actually on Railway (logs, variables, restarts): Railway. Do not move a Cloudflare app onto Railway unless the user asks.
