use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, Promise, NearToken, Gas};
use near_sdk::store::LookupMap;
use std::str::FromStr;
use serde_json;

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Auction {
    maker: AccountId,
    source_amount: NearToken,
    destination_token: String,
    destination_chain: String,
    destination_account: String,
    start_rate: u128,
    end_rate: u128,
    start_time: u64,
    duration: u64,
    timelock: u64,
    active: bool,
    hashlock: Option<[u8; 32]>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct DutchAuction {
    auctions: LookupMap<[u8; 32], Auction>,
    htlc_contract: AccountId,
}

impl Default for DutchAuction {
    fn default() -> Self {
        Self {
            auctions: LookupMap::new(b"a"),
            htlc_contract: "htlc-contract.testnet".parse::<AccountId>().unwrap(),
        }
    }
}

#[near_bindgen]
impl DutchAuction {
    #[init]
    pub fn new(htlc_contract: AccountId) -> Self {
        Self {
            auctions: LookupMap::new(b"a"),
            htlc_contract,
        }
    }

    #[payable]
    pub fn create_auction(
        &mut self,
        source_amount: String,
        destination_token: String,
        destination_chain: String,
        destination_account: String,
        start_rate: u128,
        end_rate: u128,
        duration: u64,
        timelock: u64,
    ) {
        let attached = env::attached_deposit();
        let source_u128 = u128::from_str(&source_amount).expect("Invalid source_amount");
        let source_token = NearToken::from_yoctonear(source_u128);
        assert!(attached == source_token, "Incorrect amount");
        assert!(start_rate > end_rate, "Invalid rates");
        assert!(duration > 0, "Invalid duration");

        let current_timestamp = env::block_timestamp();
        assert!(timelock > current_timestamp, "Invalid timelock: provided {} ns, current {} ns", timelock, current_timestamp);

        let hash = env::sha256(env::predecessor_account_id().as_bytes());
        let mut auction_id = [0u8; 32];
        auction_id.copy_from_slice(&hash);

        let auction = Auction {
            maker: env::predecessor_account_id(),
            source_amount: source_token,
            destination_token,
            destination_chain,
            destination_account,
            start_rate,
            end_rate,
            start_time: env::block_timestamp(),
            duration,
            timelock,
            active: true,
            hashlock: None,
        };
        self.auctions.insert(auction_id, auction);
    }

    pub fn get_current_timestamp(&self) -> u64 {
        env::block_timestamp()
    }

    pub fn get_htlc_contract(&self) -> AccountId {
        self.htlc_contract.clone()
    }


    pub fn get_current_rate(&self, auction_id: Vec<u8>) -> u128 {
        let mut id_array = [0u8; 32];
        id_array.copy_from_slice(&auction_id);
        let auction = self.auctions.get(&id_array).expect("Auction not found");
        assert!(auction.active, "Auction inactive");
        let elapsed = env::block_timestamp() - auction.start_time;
        if elapsed >= auction.duration {
            return auction.end_rate;
        }
        auction.start_rate - ((auction.start_rate - auction.end_rate) * elapsed as u128) / auction.duration as u128
    }

    pub fn fill_auction(&mut self, auction_id: Vec<u8>, preimage: Vec<u8>, fill_amount: String) {
        env::log_str("Starting fill_auction");
        let mut id_array = [0u8; 32];
        id_array.copy_from_slice(&auction_id);
        let auction = self.auctions.get(&id_array).expect("Auction not found");
        assert!(auction.active, "Auction inactive");
        let fill_u128 = u128::from_str(&fill_amount).expect("Invalid fill_amount");
        let fill_token = NearToken::from_yoctonear(fill_u128);
        assert!(fill_token <= auction.source_amount, "Invalid fill amount");
        assert!(env::block_timestamp() <= auction.start_time + auction.duration, "Auction expired");

        let elapsed = env::block_timestamp() - auction.start_time;
        let current_rate = if elapsed >= auction.duration {
            auction.end_rate
        } else {
            auction.start_rate - ((auction.start_rate - auction.end_rate) * elapsed as u128) / auction.duration as u128
        };
        let _destination_amount = (fill_u128 * current_rate) / 100;

        let mut auction = self.auctions.remove(&id_array).expect("Auction not found");
        let hash = env::sha256(&preimage);
        let mut hashlock = [0u8; 32];
        hashlock.copy_from_slice(&hash);
        auction.hashlock = Some(hashlock);

        env::log_str("Before cross-contract call");
        Promise::new(self.htlc_contract.clone()).function_call(
            "create_lock".to_string(),
            serde_json::json!({
                "receiver": env::predecessor_account_id(),
                "hashlock": hashlock,
                "timelock": auction.timelock
            }).to_string().into_bytes(),
            fill_token,
            Gas::from_gas(3_000_000_000_000_000),
        );
        env::log_str("After cross-contract call");

        auction.source_amount = auction.source_amount.saturating_sub(fill_token);
        if auction.source_amount.is_zero() {
            auction.active = false;
        }
        self.auctions.insert(id_array, auction);
    }

    pub fn cancel_auction(&mut self, auction_id: Vec<u8>) {
        let mut id_array = [0u8; 32];
        id_array.copy_from_slice(&auction_id);
        let mut auction = self.auctions.remove(&id_array).expect("Auction not found");
        assert!(auction.maker == env::predecessor_account_id(), "Not owner");
        assert!(auction.active, "Auction inactive");
        auction.active = false;
        let maker = auction.maker.clone();
        let amount = auction.source_amount;
        self.auctions.insert(id_array, auction);
        Promise::new(maker).transfer(amount);
    }
}
