use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{near_bindgen, AccountId, Promise, env, NearToken, PanicOnDefault};
use near_sdk::json_types::U128;
use base64::{engine::general_purpose, Engine as _};
use sha2::{Sha256, Digest};

#[derive(BorshDeserialize, BorshSerialize, Clone)] // Added Clone derive
pub struct Htlc {
    sender: AccountId,
    receiver: AccountId,
    amount: NearToken,
    hash_lock: String,
    time_lock: u64,
    claimed: bool,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct HtlcContract {
    htlcs: LookupMap<String, Htlc>,
    htlc_ids: Vector<String>,
    counter: u64,
}

#[near_bindgen]
impl HtlcContract {
    #[init]
    pub fn new() -> Self {
        Self {
            htlcs: LookupMap::new(b"h".to_vec()),
            htlc_ids: Vector::new(b"i".to_vec()),
            counter: 0,
        }
    }

    #[payable]
    pub fn create_htlc(&mut self, receiver: AccountId, hash_lock: String, time_lock: u64) -> String {
        let sender = env::predecessor_account_id();
        let amount = env::attached_deposit();

        if amount == NearToken::from_yoctonear(0) {
            env::panic_str("Attached deposit must be greater than zero");
        }

        if time_lock <= env::block_timestamp() {
            env::panic_str("Time lock must be in the future");
        }

        if general_purpose::STANDARD.decode(&hash_lock).is_err() {
            env::panic_str("Invalid base64 hash lock");
        }

        let htlc_id = format!("htlc-{}", self.counter);
        self.counter += 1;

        let htlc = Htlc {
            sender,
            receiver,
            amount,
            hash_lock,
            time_lock,
            claimed: false,
        };

        self.htlcs.insert(htlc_id.clone(), htlc);
        self.htlc_ids.push(htlc_id.clone());
        htlc_id
    }

    pub fn claim(&mut self, htlc_id: String, preimage: String) {
        let mut htlc = self.htlcs.get(&htlc_id).unwrap_or_else(|| env::panic_str("HTLC not found")).clone(); // Clone to own
        if env::predecessor_account_id() != htlc.receiver {
            env::panic_str("Only the receiver can claim");
        }
        if htlc.claimed {
            env::panic_str("Escrow already claimed or refunded");
        }

        let mut hasher = Sha256::new();
        hasher.update(preimage.as_bytes());
        let hash = hasher.finalize();
        let computed_hash = general_purpose::STANDARD.encode(hash);

        if computed_hash != htlc.hash_lock {
            env::panic_str("Invalid preimage");
        }

        htlc.claimed = true;
        self.htlcs.insert(htlc_id.clone(), htlc.clone());
        Promise::new(htlc.receiver).transfer(htlc.amount);
    }

    pub fn refund(&mut self, htlc_id: String) {
        let mut htlc = self.htlcs.get(&htlc_id).unwrap_or_else(|| env::panic_str("HTLC not found")).clone(); // Clone to own
        if env::predecessor_account_id() != htlc.sender {
            env::panic_str("Only the sender can refund");
        }
        if htlc.claimed {
            env::panic_str("Escrow already claimed or refunded");
        }
        if env::block_timestamp() <= htlc.time_lock {
            env::panic_str("Time lock has not expired yet");
        }

        htlc.claimed = true;
        self.htlcs.insert(htlc_id.clone(), htlc.clone());
        Promise::new(htlc.sender).transfer(htlc.amount);
    }

    pub fn get_details(&self, htlc_id: String) -> Option<(AccountId, AccountId, U128, String, u64, bool)> {
        self.htlcs.get(&htlc_id).map(|htlc| (
            htlc.sender.clone(),
            htlc.receiver.clone(),
            U128(htlc.amount.as_yoctonear()),
            htlc.hash_lock.clone(),
            htlc.time_lock,
            htlc.claimed,
        ))
    }

    pub fn list_htlcs(&self) -> Vec<String> {
        self.htlc_ids.iter().cloned().collect() // Added cloned() to collect into Vec<String>
    }
}