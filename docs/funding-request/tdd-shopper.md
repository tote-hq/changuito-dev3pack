# TDD — shopper link, lock, settle, language

Two issues: the funding link and settle on the shopper app, and English as the default language.

## Copy link

On the cart, beside "Proceed to checkout" / "Proceder al pago", a secondary button "Copy funding link".

It is shown when the shopper has a Pollar Solana address and a cart total. The click writes `funding_request` (id, wallet, amount ARS, concept, expires_at) and copies:

`https://pay.changuito.me/r/{id}?wallet={pubkey}&concept=Pay%20a%20friend%27s%20supermarket%20cart`

No email. No QR. No product query. The pay origin is `NEXT_PUBLIC_PAY_ORIGIN`.

The Solana address comes from A's Pollar session at that click. It is not typed into the link by hand. Reading it may require a Pollar SDK that can return the Solana wallet. The Stellar session stays.

## Funded line

A polls the Pollar Solana USDC balance. When it is higher than it was at the moment the link was copied, the cart shows "Someone funded this cart." The shopper can then press "Proceed to checkout".

The line is not an agent message. A read-only chat still shows it on the cart if the balance moved. It does not resume the agent.

## Lock

Before the demo run spends the funds, A signs `lock` on the new program with the Pollar Solana wallet, for the quoted USDC amount stored on the funding row. The order id is the funding row id. The basket hash is the cart the demo will run.

This is the buyer's signature. Settle is not.

## Settle

When the demo reaches the payment step, `apps/web` calls settle with `SOLANA_RESOLVER_SECRET`. The same place the Stellar demo settles today. The resolver signature is the only one on that transaction. The USDC moves from the program vault to the treasury account `9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc`.

The demo still stops there. It does not pay Día or Coto.

If the demo fails before that step, the resolver signs `refund` and the USDC returns to A's wallet.

`SOLANA_ESCROW_ID` and `SOLANA_RPC_URL` are required for both transactions. Stellar settle is unchanged and still uses its own key.

## Language

Issue: Default the shopper language to English.

`DEFAULT_LANG` in `apps/web/lib/lang.ts` becomes `en`. The switch lists English first and Spanish second. A cookie already set to Spanish still wins. The first visit with no cookie is English.

`apps/pay` is English only and has no switch.
