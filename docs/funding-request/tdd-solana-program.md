# TDD — Solana custody program

Issue: Deploy the Solana devnet custody program.

The Stellar escrow stays. This program is the same job on Solana devnet: hold the buyer's USDC, let the resolver send it to the treasury when the demo reaches payment, and let the resolver send it back when the demo does not.

## Accounts

Wired at deploy. The private keys are entered in the worker at deploy time. They are not committed.

| Role | Address | Signs |
|---|---|---|
| deployer | `57NLdwkHrqRrmydcVzWLQup4D5yRuC6W4MHqYeuYUgFi` | Deploy and upgrade only |
| resolver | `5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD` | `settle` and `refund` |
| treasury | `9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc` | Receives a settled basket |

Mint: Circle devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

The buyer is user A's Pollar Solana wallet. The buyer signs `lock`. The buyer cannot sign `settle` or `refund`.

## Instructions

`lock`

- Moves `amount` of that mint from the buyer's token account into a program vault tied to an order id.
- Records buyer, amount, and a basket hash.
- Rejects a second lock for the same order id.

`settle`

- Signer is the resolver only.
- Moves the vault balance to the treasury.
- Status becomes settled. A second settle does nothing useful and does not pay twice.

`refund`

- Signer is the resolver only.
- Moves the vault balance back to the buyer's token account.
- Used when the demo fails before the payment step. This cut does not add a new failure UI.

There is no fee argument in this cut. The whole locked amount goes to the treasury on settle, which is the custody the demo needs. A separate fee can wait.

## What this issue ships

- The program crate and tests for lock, settle, refund, and a rejected second settle.
- No devnet deploy. `SOLANA_ESCROW_ID` stays empty until the deploy that happens after every funding issue is merged.
- The crate README names the resolver, the treasury, and the mint. It does not invent a program id.

## Out of this issue

The ramp, the pay page, the shopper button, and the devnet deploy. The later issues call this program. They do not deploy it.
