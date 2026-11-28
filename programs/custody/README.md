# Custody program

Solana program that holds Circle devnet USDC for one cart.

The program id is not in this crate. After the funding issues are merged, deploy to devnet and set `SOLANA_ESCROW_ID` on the shopper worker. Do not deploy from this change.

Accounts expected by the client:

| Role | Address |
|---|---|
| Resolver (settle and refund) | `5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD` |
| Treasury (settle destination) | `9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc` |
| USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

Instructions (first byte): `0` lock, `1` settle, `2` refund.

`lock` data after the tag: 32-byte order id, little-endian u64 amount, 32-byte basket hash. The buyer must sign and pays the rent. `lock` creates the vault account itself: the PDA `["vault", order_id]`, 105 bytes, owned by this program. A client cannot create that address. A second lock finds the account already owned by the program and fails because it is no longer empty.

The client creates the buyer's USDC token account and the vault's USDC token account (owner = the PDA) before `lock`. `lock` moves the USDC from the buyer into the vault token account. `settle` moves that amount to the treasury token account. `refund` moves it back to the buyer. Both are signed by the resolver; the program signs the token transfer as the PDA. A second settle fails.

Clients pass the program id from `SOLANA_ESCROW_ID`. This crate does not embed a deployed address.
