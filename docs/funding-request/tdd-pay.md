# TDD — pay.changuito.me

Issue: Add the pay app.

New app at `apps/pay`, deployed on its own worker, hostname `pay.changuito.me`. It does not import the shopper UI. English only.

## Link

User A creates the row in the shopper app (see [tdd-shopper.md](./tdd-shopper.md)). This app only opens it.

`https://pay.changuito.me/r/{id}?wallet={pubkey}&concept={text}`

`id` is the row. `wallet` must match the row or the page refuses. `concept` is the fixed English line "Pay a friend's supermarket cart". The URL has no product list and no amount. The amount is the cart total stored on the row.

The row's `expires_at` is 15 minutes after A created it. That clock does not move when B arrives.

## Open

`GET /r/{id}` loads the page.

If `now` is past `expires_at` and no ramp order exists, the page says the link expired.

If no ramp order exists and the link is still live:

1. The worker quotes `POST /api/ramp/v1/quotes` with fiat `ARS`, the stored cart total, denomination `fiat`, direction `onramp`.
2. The quote is the only exchange rate. The app does not price ARS itself.
3. If the quoted USDC is over 5, or the ramp refuses with `too_large` or `no_liquidity`, the page says the cart is over the demo limit and does not create an order.
4. Otherwise `POST /api/ramp/v1/orders` with that quote's amount, `wallet` from the row, and an idempotency key equal to the row id.
5. The worker stores `ramp_order_id` and the sandbox `link`.

If an order already exists, the page does not create another one.

The browser never sees `SANDBOX_RAMP_TOKEN`.

## What B sees

- The concept.
- The ARS total and the quoted USDC.
- A link to the sandbox `link` (the page with "Simulate transfer"). Same tab or a new tab. Not an iframe.
- A status line, polled every 5 seconds from `GET /api/ramp-status?id={id}` on this app.

That route reads the row and calls `GET /api/ramp/v1/orders/{id}` with the bearer. It returns only `awaiting_transfer`, `received`, `paying`, `completed`, or a terminal failure (`error`, `refunded`, `expired`).

When the status is `completed`, the page says the payment is in and the window can be closed. B's success is this status. It does not wait for A's balance.

## Data

Table `funding_request`, written by the shopper app, read and updated here:

| Column | Note |
|---|---|
| `id` | uuid, in the URL |
| `wallet` | A's Solana address |
| `amount_ars` | cart total |
| `concept` | the English line |
| `expires_at` | created_at + 15 minutes |
| `ramp_order_id` | null until B opens |
| `ramp_link` | sandbox link |
| `quoted_usdc` | from the quote |
| `status` | `open`, then the ramp status |

## Env

`SANDBOX_RAMP_TOKEN`, `SOLANA_RPC_URL` is not required on this app. This app does not read the chain. A does.
