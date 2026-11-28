//! State transitions for one vault. No accounts, so the tests do not need a cluster.

use solana_program::pubkey;
use solana_program::pubkey::Pubkey;

/// `5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD`
pub const RESOLVER: Pubkey = pubkey!("5zeMdzZCXkCHbTwvoxtEHRHCP5fe7MLc4fHgG54ENhUD");
/// `9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc`
pub const TREASURY: Pubkey = pubkey!("9TNtBk4RL2dmYdffqfudhLGc1DEtnHc8nmw7yWcD2ctc");
/// Circle devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

pub type OrderId = [u8; 32];
pub type BasketHash = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VaultStatus {
    Empty,
    Locked,
    Settled,
    Refunded,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Vault {
    pub status: VaultStatus,
    pub buyer: Pubkey,
    pub amount: u64,
    pub basket: BasketHash,
    pub order: OrderId,
}

impl Vault {
    pub const fn empty() -> Self {
        Self {
            status: VaultStatus::Empty,
            buyer: Pubkey::new_from_array([0; 32]),
            amount: 0,
            basket: [0; 32],
            order: [0; 32],
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Transition {
    Lock {
        buyer: Pubkey,
        amount: u64,
        basket: BasketHash,
        order: OrderId,
    },
    Settle,
    Refund,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LogicError {
    NotEmpty,
    NotLocked,
    AlreadySettled,
    ZeroAmount,
    WrongSigner,
}

/// Applies one instruction. `settle` and `refund` require `signer == RESOLVER`.
pub fn apply(vault: &Vault, step: Transition, signer: &Pubkey) -> Result<Vault, LogicError> {
    match step {
        Transition::Lock {
            buyer,
            amount,
            basket,
            order,
        } => {
            if signer != &buyer {
                return Err(LogicError::WrongSigner);
            }
            if vault.status != VaultStatus::Empty {
                return Err(LogicError::NotEmpty);
            }
            if amount == 0 {
                return Err(LogicError::ZeroAmount);
            }
            Ok(Vault {
                status: VaultStatus::Locked,
                buyer,
                amount,
                basket,
                order,
            })
        }
        Transition::Settle => {
            if signer != &RESOLVER {
                return Err(LogicError::WrongSigner);
            }
            match vault.status {
                VaultStatus::Locked => Ok(Vault {
                    status: VaultStatus::Settled,
                    ..*vault
                }),
                VaultStatus::Settled => Err(LogicError::AlreadySettled),
                _ => Err(LogicError::NotLocked),
            }
        }
        Transition::Refund => {
            if signer != &RESOLVER {
                return Err(LogicError::WrongSigner);
            }
            if vault.status != VaultStatus::Locked {
                return Err(LogicError::NotLocked);
            }
            Ok(Vault {
                status: VaultStatus::Refunded,
                ..*vault
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn buyer() -> Pubkey {
        Pubkey::new_from_array([7; 32])
    }

    fn locked() -> Vault {
        apply(
            &Vault::empty(),
            Transition::Lock {
                buyer: buyer(),
                amount: 1_000_000,
                basket: [9; 32],
                order: [3; 32],
            },
            &buyer(),
        )
        .unwrap()
    }

    #[test]
    fn lock_records_buyer_amount_and_basket() {
        let vault = locked();
        assert_eq!(vault.status, VaultStatus::Locked);
        assert_eq!(vault.buyer, buyer());
        assert_eq!(vault.amount, 1_000_000);
        assert_eq!(vault.basket, [9; 32]);
        assert_eq!(vault.order, [3; 32]);
    }

    #[test]
    fn second_lock_is_rejected() {
        let err = apply(
            &locked(),
            Transition::Lock {
                buyer: buyer(),
                amount: 1,
                basket: [1; 32],
                order: [3; 32],
            },
            &buyer(),
        )
        .unwrap_err();
        assert_eq!(err, LogicError::NotEmpty);
    }

    #[test]
    fn buyer_cannot_lock_for_someone_else() {
        let other = Pubkey::new_from_array([8; 32]);
        let err = apply(
            &Vault::empty(),
            Transition::Lock {
                buyer: buyer(),
                amount: 1,
                basket: [1; 32],
                order: [3; 32],
            },
            &other,
        )
        .unwrap_err();
        assert_eq!(err, LogicError::WrongSigner);
    }

    #[test]
    fn settle_moves_to_settled_once() {
        let settled = apply(&locked(), Transition::Settle, &RESOLVER).unwrap();
        assert_eq!(settled.status, VaultStatus::Settled);
        assert_eq!(settled.amount, 1_000_000);
        let err = apply(&settled, Transition::Settle, &RESOLVER).unwrap_err();
        assert_eq!(err, LogicError::AlreadySettled);
    }

    #[test]
    fn buyer_cannot_settle() {
        let err = apply(&locked(), Transition::Settle, &buyer()).unwrap_err();
        assert_eq!(err, LogicError::WrongSigner);
    }

    #[test]
    fn refund_returns_the_locked_vault_to_the_buyer() {
        let refunded = apply(&locked(), Transition::Refund, &RESOLVER).unwrap();
        assert_eq!(refunded.status, VaultStatus::Refunded);
        assert_eq!(refunded.buyer, buyer());
        assert_eq!(refunded.amount, 1_000_000);
    }

    #[test]
    fn buyer_cannot_refund() {
        let err = apply(&locked(), Transition::Refund, &buyer()).unwrap_err();
        assert_eq!(err, LogicError::WrongSigner);
    }
}
