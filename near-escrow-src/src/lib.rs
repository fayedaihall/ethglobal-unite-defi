use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::store::LookupMap;
use near_sdk::{env, near_bindgen, AccountId, Gas, Promise, PromiseOrValue, NearToken};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::json_types::U128;
use near_sdk::ext_contract;
use near_sdk::serde_json;
use sha2::{Digest, Sha256};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct LockParams {
    pub lock_id: String,
    pub secret_hash: Vec<u8>,
    pub timelock: u64,
    pub receiver_id: AccountId,
    pub amount: U128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct EscrowSrc {
    locks: LookupMap<String, Lock>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Lock {
    secret_hash: Vec<u8>,  // SHA-256 hash
    amount: u128,         // FT amount in token's denomination
    token: AccountId,     // Token contract
    maker: AccountId,     // User who locked
    receiver: AccountId,  // Resolver who can claim
    timelock: u64,        // Seconds since Unix epoch
}

impl Default for EscrowSrc {
    fn default() -> Self {
        Self { locks: LookupMap::new(b"l".to_vec()) }
    }
}

#[near_bindgen]
impl EscrowSrc {
    /// User calls to validate lock params (called via ft_transfer_call)
    pub fn lock(&mut self, lock_id: String, secret_hash: Vec<u8>, timelock: u64, receiver_id: AccountId) {
        // Validate inputs
        if lock_id.is_empty() {
            env::panic_str("Lock ID cannot be empty");
        }
        if self.locks.get(&lock_id).is_some() {
            env::panic_str("Lock ID already exists");
        }
        if secret_hash.len() != 32 {
            env::panic_str("Secret hash must be 32 bytes (SHA-256)");
        }
        let current_time = env::block_timestamp() / 1_000_000_000;  // Convert ns to seconds
        if timelock <= current_time {
            env::panic_str("Timelock must be in the future");
        }
        if !env::is_valid_account_id(receiver_id.as_bytes()) {
            env::panic_str("Invalid receiver ID");
        }
        // No deposit expected; transfer handled by ft_transfer_call
        if env::attached_deposit() != NearToken::from_yoctonear(0) {
            env::panic_str("No deposit expected for lock; use ft_transfer_call");
        }
        // Parameters validated; actual lock in on_ft_transfer_call
    }

    /// Callback after ft_transfer_call from token contract
    #[payable]
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        env::log_str(&format!("Received msg: {}", msg));
        // Ensure called by token contract
        let token = env::predecessor_account_id();
        // Parse msg for lock_id, secret_hash, timelock, receiver_id
        let params: LockParams = serde_json::from_str(&msg).expect("Invalid JSON in msg");
        // Re-validate params
        if params.lock_id.is_empty() {
            env::panic_str("Lock ID cannot be empty");
        }
        if self.locks.get(&params.lock_id).is_some() {
            env::panic_str("Lock ID already exists");
        }
        if params.secret_hash.len() != 32 {
            env::panic_str("Secret hash must be 32 bytes");
        }
        if params.timelock <= env::block_timestamp() / 1_000_000_000 {
            env::panic_str("Timelock must be in the future");
        }
        if !env::is_valid_account_id(params.receiver_id.as_bytes()) {
            env::panic_str("Invalid receiver ID");
        }
        if params.amount.0 != amount.0 {
            env::panic_str("Amount mismatch");
        }
        // Store lock
        self.locks.insert(params.lock_id, Lock {
            secret_hash: params.secret_hash,
            amount: amount.0,
            token,
            maker: sender_id,
            receiver: params.receiver_id,
            timelock: params.timelock,
        });
        // Return 0 to indicate successful transfer (NEP-141)
        PromiseOrValue::Value(U128(0))
    }

    /// Claim with preimage (restricted to receiver)
    pub fn claim(&mut self, lock_id: String, preimage: Vec<u8>) {
        let lock = self.locks.get(&lock_id).expect("No lock");
        let hash = env::sha256(&preimage);
        if hash != lock.secret_hash {
            let preimage_hex = hex::encode(&preimage);
            let hash_hex = hex::encode(&hash);
            let expected_hash_hex = hex::encode(&lock.secret_hash);
            let error_msg = format!(
                "Invalid preimage: preimage={}, computed_hash={}, expected_hash={}",
                preimage_hex, hash_hex, expected_hash_hex
            );
            env::panic_str(&error_msg);
        }
        if env::block_timestamp() / 1_000_000_000 >= lock.timelock {
            env::panic_str("Expired");
        }
        if env::predecessor_account_id() != lock.receiver {
            env::panic_str("Only receiver can claim");
        }
        // Transfer to receiver
        ext_ft::ext(lock.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(5))
            .ft_transfer(lock.receiver.clone(), U128(lock.amount), None);
        self.locks.remove(&lock_id);
    }

    /// Refund to maker after timelock
    pub fn refund(&mut self, lock_id: String) {
        let lock = self.locks.get(&lock_id).expect("No lock");
        if env::block_timestamp() / 1_000_000_000 < lock.timelock {
            env::panic_str("Not expired");
        }
        if env::predecessor_account_id() != lock.maker {
            env::panic_str("Only maker");
        }
        ext_ft::ext(lock.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(5))
            .ft_transfer(lock.maker.clone(), U128(lock.amount), None);
        self.locks.remove(&lock_id);
    }
}

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(receiver_id: AccountId, amount: U128, msg: String) -> Promise;
}