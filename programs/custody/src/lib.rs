//! Custody for one funded cart on Solana devnet.
//!
//! The buyer signs `lock`. Only the resolver signs `settle` and `refund`.
//! This crate is not deployed from CI. The program id is supplied later as
//! `SOLANA_ESCROW_ID`.

use solana_program::entrypoint::ProgramResult;
use solana_program::pubkey::Pubkey;

mod logic;
mod processor;

pub use logic::{
    apply, BasketHash, OrderId, Transition, Vault, VaultStatus, RESOLVER, TREASURY, USDC_MINT,
};
pub use processor::process;

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[solana_program::account_info::AccountInfo],
    data: &[u8],
) -> ProgramResult {
    process(program_id, accounts, data)
}
