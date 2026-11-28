//! Instruction entry. Account checks and the USDC move live here.
//! The vault rules live in `logic`.

use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::instruction::{AccountMeta, Instruction};
use solana_program::program::{invoke, invoke_signed};
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::system_instruction;
use solana_program::sysvar::Sysvar;

use crate::logic::{
    apply, LogicError, OrderId, Transition, Vault, VaultStatus, RESOLVER, TREASURY, USDC_MINT,
};

const LOCK: u8 = 0;
const SETTLE: u8 = 1;
const REFUND: u8 = 2;
/// status + buyer + amount + basket + order id
const VAULT_LEN: usize = 1 + 32 + 8 + 32 + 32;
/// SPL Token `Transfer`.
const TOKEN_TRANSFER: u8 = 3;

/// `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
pub const TOKEN_PROGRAM: Pubkey = solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

pub fn vault_address(program_id: &Pubkey, order: &OrderId) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", order], program_id)
}

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let (tag, rest) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    match *tag {
        LOCK => lock(program_id, accounts, rest),
        SETTLE => settle(program_id, accounts),
        REFUND => refund(program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

/// 0 buyer (signer, pays rent), 1 buyer token, 2 vault, 3 vault token,
/// 4 token program, 5 mint, 6 system program.
/// Data: order id (32) || amount (u64 le) || basket hash (32).
fn lock(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 32 + 8 + 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let buyer = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !buyer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let buyer_token = accounts.get(1).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let vault_info = accounts.get(2).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let vault_token = accounts.get(3).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let token_program = accounts.get(4).ok_or(ProgramError::NotEnoughAccountKeys)?;
    check_mint(accounts.get(5).ok_or(ProgramError::NotEnoughAccountKeys)?)?;
    let system_program = accounts.get(6).ok_or(ProgramError::NotEnoughAccountKeys)?;

    let mut order = [0u8; 32];
    order.copy_from_slice(&data[0..32]);
    let amount = u64::from_le_bytes(data[32..40].try_into().unwrap());
    let mut basket = [0u8; 32];
    basket.copy_from_slice(&data[40..72]);

    let (pda, bump) = vault_address(program_id, &order);
    if vault_info.key != &pda {
        return Err(ProgramError::InvalidAccountData);
    }
    if vault_info.owner != program_id {
        create_vault(buyer, vault_info, system_program, program_id, &order, bump)?;
    }
    token_owned_by(buyer_token, buyer.key)?;
    token_owned_by(vault_token, &pda)?;

    let mut vault = read_vault(vault_info)?;
    vault = apply(
        &vault,
        Transition::Lock {
            buyer: *buyer.key,
            amount,
            basket,
            order,
        },
        buyer.key,
    )
    .map_err(map_logic)?;

    transfer(token_program, buyer_token, vault_token, buyer, amount, &[])?;
    write_vault(vault_info, &vault)?;
    Ok(())
}

/// 0 resolver (signer), 1 treasury wallet, 2 vault, 3 vault token, 4 treasury token,
/// 5 token program, 6 mint.
fn settle(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let signer = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !signer.is_signer || signer.key != &RESOLVER {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let treasury = accounts.get(1).ok_or(ProgramError::NotEnoughAccountKeys)?;
    if treasury.key != &TREASURY {
        return Err(ProgramError::InvalidAccountData);
    }
    let vault_info = accounts.get(2).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let vault_token = accounts.get(3).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let treasury_token = accounts.get(4).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let token_program = accounts.get(5).ok_or(ProgramError::NotEnoughAccountKeys)?;
    check_mint(accounts.get(6).ok_or(ProgramError::NotEnoughAccountKeys)?)?;

    let vault = read_vault(vault_info)?;
    let (pda, bump) = vault_address(program_id, &vault.order);
    if vault_info.key != &pda || vault_info.owner != program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    token_owned_by(vault_token, &pda)?;
    token_owned_by(treasury_token, &TREASURY)?;

    let next = apply(&vault, Transition::Settle, signer.key).map_err(map_logic)?;
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[b"vault", vault.order.as_ref(), &bump_seed];
    transfer(token_program, vault_token, treasury_token, vault_info, vault.amount, seeds)?;
    write_vault(vault_info, &next)?;
    Ok(())
}

/// 0 resolver (signer), 1 buyer, 2 vault, 3 vault token, 4 buyer token,
/// 5 token program, 6 mint.
fn refund(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let signer = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !signer.is_signer || signer.key != &RESOLVER {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let buyer = accounts.get(1).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let vault_info = accounts.get(2).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let vault_token = accounts.get(3).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let buyer_token = accounts.get(4).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let token_program = accounts.get(5).ok_or(ProgramError::NotEnoughAccountKeys)?;
    check_mint(accounts.get(6).ok_or(ProgramError::NotEnoughAccountKeys)?)?;

    let vault = read_vault(vault_info)?;
    if buyer.key != &vault.buyer {
        return Err(ProgramError::InvalidAccountData);
    }
    let (pda, bump) = vault_address(program_id, &vault.order);
    if vault_info.key != &pda || vault_info.owner != program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    token_owned_by(vault_token, &pda)?;
    token_owned_by(buyer_token, buyer.key)?;

    let next = apply(&vault, Transition::Refund, signer.key).map_err(map_logic)?;
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[b"vault", vault.order.as_ref(), &bump_seed];
    transfer(token_program, vault_token, buyer_token, vault_info, vault.amount, seeds)?;
    write_vault(vault_info, &next)?;
    Ok(())
}

fn create_vault<'a>(
    payer: &AccountInfo<'a>,
    vault: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    program_id: &Pubkey,
    order: &OrderId,
    bump: u8,
) -> ProgramResult {
    if system_program.key != &solana_program::system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    let lamports = Rent::get()?.minimum_balance(VAULT_LEN);
    let ix = system_instruction::create_account(
        payer.key,
        vault.key,
        lamports,
        VAULT_LEN as u64,
        program_id,
    );
    let bump_seed = [bump];
    invoke_signed(
        &ix,
        &[payer.clone(), vault.clone(), system_program.clone()],
        &[&[b"vault", order.as_ref(), &bump_seed]],
    )
}

pub fn transfer_data(amount: u64) -> [u8; 9] {
    let mut data = [0u8; 9];
    data[0] = TOKEN_TRANSFER;
    data[1..].copy_from_slice(&amount.to_le_bytes());
    data
}

fn transfer<'a>(
    token_program: &AccountInfo<'a>,
    source: &AccountInfo<'a>,
    dest: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    amount: u64,
    signer_seeds: &[&[u8]],
) -> ProgramResult {
    if token_program.key != &TOKEN_PROGRAM {
        return Err(ProgramError::IncorrectProgramId);
    }
    let ix = Instruction {
        program_id: TOKEN_PROGRAM,
        accounts: vec![
            AccountMeta::new(*source.key, false),
            AccountMeta::new(*dest.key, false),
            AccountMeta::new_readonly(*authority.key, true),
        ],
        data: transfer_data(amount).to_vec(),
    };
    let infos = [
        source.clone(),
        dest.clone(),
        authority.clone(),
        token_program.clone(),
    ];
    if signer_seeds.is_empty() {
        invoke(&ix, &infos)
    } else {
        invoke_signed(&ix, &infos, &[signer_seeds])
    }
}

fn check_mint(mint: &AccountInfo) -> ProgramResult {
    if mint.key != &USDC_MINT {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}

fn token_owned_by(account: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if account.owner != &TOKEN_PROGRAM {
        return Err(ProgramError::InvalidAccountData);
    }
    let data = account.try_borrow_data()?;
    if data.len() < 64 || &data[0..32] != USDC_MINT.as_ref() || &data[32..64] != owner.as_ref() {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}

fn read_vault(info: &AccountInfo) -> Result<Vault, ProgramError> {
    let data = info.try_borrow_data()?;
    if data.len() < VAULT_LEN {
        return Err(ProgramError::InvalidAccountData);
    }
    if data.iter().take(VAULT_LEN).all(|b| *b == 0) {
        return Ok(Vault::empty());
    }
    let status = match data[0] {
        1 => VaultStatus::Locked,
        2 => VaultStatus::Settled,
        3 => VaultStatus::Refunded,
        _ => return Err(ProgramError::InvalidAccountData),
    };
    let mut buyer = [0u8; 32];
    buyer.copy_from_slice(&data[1..33]);
    let amount = u64::from_le_bytes(data[33..41].try_into().unwrap());
    let mut basket = [0u8; 32];
    basket.copy_from_slice(&data[41..73]);
    let mut order = [0u8; 32];
    order.copy_from_slice(&data[73..105]);
    Ok(Vault {
        status,
        buyer: Pubkey::new_from_array(buyer),
        amount,
        basket,
        order,
    })
}

fn write_vault(info: &AccountInfo, vault: &Vault) -> ProgramResult {
    let mut data = info.try_borrow_mut_data()?;
    if data.len() < VAULT_LEN {
        return Err(ProgramError::InvalidAccountData);
    }
    data[0] = match vault.status {
        VaultStatus::Empty => 0,
        VaultStatus::Locked => 1,
        VaultStatus::Settled => 2,
        VaultStatus::Refunded => 3,
    };
    data[1..33].copy_from_slice(vault.buyer.as_ref());
    data[33..41].copy_from_slice(&vault.amount.to_le_bytes());
    data[41..73].copy_from_slice(&vault.basket);
    data[73..105].copy_from_slice(&vault.order);
    Ok(())
}

fn map_logic(err: LogicError) -> ProgramError {
    match err {
        LogicError::WrongSigner => ProgramError::MissingRequiredSignature,
        LogicError::AlreadySettled | LogicError::NotEmpty | LogicError::NotLocked => {
            ProgramError::InvalidAccountData
        }
        LogicError::ZeroAmount => ProgramError::InvalidInstructionData,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transfer_encodes_spl_transfer_and_the_whole_amount() {
        let data = transfer_data(1_500_000);
        assert_eq!(data[0], 3);
        assert_eq!(u64::from_le_bytes(data[1..].try_into().unwrap()), 1_500_000);
    }
}
