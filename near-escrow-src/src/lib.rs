use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::store::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{near_bindgen, AccountId, Promise, env, log, BorshStorageKey, Gas, NearToken};
use schemars::JsonSchema;

// Newtype to make AccountId compatible with JsonSchema
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, JsonSchema, PartialEq)]
#[serde(transparent)]
pub struct JsonAccountId(String);

impl JsonAccountId {
    pub fn new(account_id: AccountId) -> Self {
        JsonAccountId(account_id.to_string())
    }

    pub fn inner(&self) -> AccountId {
        self.0.parse().expect("Invalid AccountId")
    }

    pub fn into_inner(self) -> AccountId {
        self.0.parse().expect("Invalid AccountId")
    }
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, JsonSchema, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Escrow {
    sender: JsonAccountId,
    token: JsonAccountId,
    amount: u128,
    hashlock: [u8; 32],
    timelock_exclusive: u64,
    timelock_recovery: u64,
    withdrawn: bool,
    resolver: Option<JsonAccountId>,
}

#[derive(BorshStorageKey, BorshSerialize)]
enum StorageKey {
    Escrows,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Contract {
    escrows: LookupMap<u64, Escrow>,
    next_id: u64,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            escrows: LookupMap::new(StorageKey::Escrows),
            next_id: 0,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct LockMsg {
    hashlock: String, // hex string
    timelock: u64, // seconds
    dest_chain: String,
    dest_user: String,
    min_return: String,
    output_token: String,
    resolver_id: Option<JsonAccountId>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self::default()
    }

    #[payable]
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> U128 {
        let token = env::predecessor_account_id();
        let params: LockMsg = near_sdk::serde_json::from_str(&msg).unwrap();
        let hashlock_vec = hex::decode(params.hashlock).unwrap();
        let hashlock: [u8; 32] = hashlock_vec.try_into().unwrap();
        let id = self.next_id;
        self.next_id += 1;
        let current = env::block_timestamp() / 1_000_000_000;
        self.escrows.insert(id, Escrow {
            sender: JsonAccountId::new(sender_id),
            token: JsonAccountId::new(token),
            amount: amount.0,
            hashlock,
            timelock_exclusive: current + params.timelock / 2,
            timelock_recovery: current + params.timelock,
            withdrawn: false,
            resolver: params.resolver_id,
        });
        log!("Escrow created: {}", id);
        U128(0)
    }

    pub fn register_resolver(&mut self, id: u64) {
        let escrow = self.escrows.get(&id).expect("Escrow not found").clone();
        if escrow.resolver.is_none() {
            let mut updated_escrow = escrow;
            updated_escrow.resolver = Some(JsonAccountId::new(env::predecessor_account_id()));
            self.escrows.insert(id, updated_escrow);
        }
    }

    pub fn withdraw(&mut self, id: u64, preimage: String) {
        let escrow = self.escrows.get(&id).expect("Escrow not found").clone();
        let hash = env::sha256(preimage.as_bytes());
        if hash != escrow.hashlock.to_vec() {
            panic!("Invalid preimage");
        }
        if escrow.withdrawn {
            panic!("Withdrawn");
        }
        let current = env::block_timestamp() / 1_000_000_000;
        if current >= escrow.timelock_recovery {
            panic!("Expired");
        }
        if current < escrow.timelock_exclusive {
            if let Some(resolver) = &escrow.resolver {
                if JsonAccountId::new(env::predecessor_account_id()) != *resolver {
                    panic!("Only resolver during exclusive period");
                }
            } else {
                // No resolver set, allow withdrawal from anyone if we're past half the timelock
                panic!("No resolver set - cannot withdraw during exclusive period");
            }
        }
        let mut updated_escrow = escrow.clone();
        updated_escrow.withdrawn = true;
        self.escrows.insert(id, updated_escrow);
        let resolver = match escrow.resolver {
            Some(resolver) => resolver.into_inner(),
            None => escrow.sender.into_inner(), // Fallback to sender if no resolver
        };
        Promise::new(escrow.token.into_inner()).function_call(
            "ft_transfer".into(),
            near_sdk::serde_json::json!({
                "receiver_id": resolver,
                "amount": U128(escrow.amount)
            })
            .to_string()
            .into_bytes(),
            NearToken::from_yoctonear(1),
            Gas::from_tgas(5),
        );
    }

    pub fn refund(&mut self, id: u64) {
        let escrow = self.escrows.get(&id).expect("Escrow not found").clone();
        if escrow.withdrawn {
            panic!("Withdrawn");
        }
        let current = env::block_timestamp() / 1_000_000_000;
        if current < escrow.timelock_recovery {
            panic!("Not expired");
        }
        let mut updated_escrow = escrow.clone();
        updated_escrow.withdrawn = true;
        self.escrows.insert(id, updated_escrow);
        Promise::new(escrow.token.into_inner()).function_call(
            "ft_transfer".into(),
            near_sdk::serde_json::json!({
                "receiver_id": escrow.sender.into_inner(),
                "amount": U128(escrow.amount)
            })
            .to_string()
            .into_bytes(),
            NearToken::from_yoctonear(1),
            Gas::from_tgas(5),
        );
    }

    pub fn get_escrow(&self, id: u64) -> Option<Escrow> {
        self.escrows.get(&id).cloned()
    }
}