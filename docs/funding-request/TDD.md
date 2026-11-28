# Funding request

Index of the funding work. Replaces the Mercado Pago draft.

Public text for this work is English, including `pay.changuito.me` and the demo video.

## Closed decisions

- Fiat in is the Pollar sandbox ramp, `POST https://sandbox-anchor.pollar.xyz/api/ramp/v1/orders`. Not SEP-24. Not Mercado Pago.
- The ramp pays Circle devnet USDC, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, to user A's Pollar Solana wallet.
- The ARS rate is the ramp quote. The amount is the cart total. If that quote is above 5 USDC, or the wallet would pass 20 USDC for the day, the order is not created.
- A copies a link. There is no email and no QR. B pays with the sandbox's own "Simulate transfer" page.
- The ramp order is created when B opens the link. The 15 minutes run from when A created the link. After that, a link with no order is dead. An order already created can still be polled until the ramp reaches a terminal status.
- B's success is ramp status `completed`. A sees it as a Solana USDC balance change and a line that someone funded the cart.
- `pay.changuito.me` is a new app in `apps/pay`. It does not iframe the sandbox and does not depend on a sandbox redirect. It links to the ramp's `link` and polls our worker for status.
- The worker holds the ramp credential. The browser never does.
- Stellar env and contracts stay. Solana is a second path.
- The new program custodies the USDC. A signs the lock with the Pollar Solana wallet. `SOLANA_RESOLVER_SECRET` is the only signer of settle, and settle runs when the demo reaches payment ("Llegamos hasta el pago" / "We reached payment"). It does not pay the supermarket.
- The link shows the destination wallet and the concept. It does not list products.

## Issues

| Issue | Owns | TDD |
|---|---|---|
| Deploy the Solana devnet custody program | Program, the three keys, lock and settle instructions | [tdd-solana-program.md](./tdd-solana-program.md) |
| Add the pay app | `apps/pay`, ramp quote and order, status for B | [tdd-pay.md](./tdd-pay.md) |
| Add the shopper funding link and settle | Copy link, funded line, lock, settle at the demo payment step | [tdd-shopper.md](./tdd-shopper.md) |
| Default the shopper language to English | `DEFAULT_LANG`, switch order | [tdd-shopper.md](./tdd-shopper.md) |

## Worker variables

Stellar variables stay (`STELLAR_RESOLVER_SECRET`, `STELLAR_SPONSOR_SECRET`, `OZ_CHANNELS_API_KEY`, the contract ids).

| Name | Where | What |
|---|---|---|
| `SANDBOX_RAMP_TOKEN` | `apps/pay` worker, server only | Bearer for `sandbox-anchor.pollar.xyz/api/ramp/v1`. Created in the Pollar dashboard: [API keys](https://docs.pollar.xyz/docs/getting-started/api-keys), Test mode, secret key. Not committed. |
| `SOLANA_RESOLVER_SECRET` | `apps/web` worker, server only | Signs settle and refund. Supplied at deploy, not in git. |
| `SOLANA_RPC_URL` | both workers, server only | Solana devnet. Not a public mainnet endpoint. |
| `SOLANA_ESCROW_ID` | `apps/web`, runtime | Program id after deploy. |
| `NEXT_PUBLIC_PAY_ORIGIN` | `apps/web` build | `https://pay.changuito.me` |

The USDC mint is the public Circle devnet mint above. It is a constant, not a secret.

## Accounts

| Role | Address |
|---|---|
| deployer | `57NLdwkHrqRrmydcVzWLQup4D5yRuC6W4MHqYeuYUgFi` |
| resolver | `5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD` |
| treasury | `9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc` |
