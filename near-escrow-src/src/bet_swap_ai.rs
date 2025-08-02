use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Promise};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct BetEvent {
    pub description: String,
    pub end_time: u64,
    pub resolved: bool,
    pub outcome: bool,
    pub total_bets: u128,
    pub user_bets: LookupMap<AccountId, u128>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct CrossChainBet {
    pub user: AccountId,
    pub event_id: String,
    pub amount: u128,
    pub outcome: bool,
    pub is_cross_chain: bool,
    pub eth_address: String,
    pub completed: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct AIOutcomePrediction {
    pub event_id: String,
    pub predicted_outcome: bool,
    pub confidence: u64,
    pub oracle_data: String,
    pub timestamp: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct BetSwapIntent {
    pub user: AccountId,
    pub event_id: String,
    pub amount: u128,
    pub outcome: bool,
    pub target_chain: String, // "ETH" or "NEAR"
    pub deadline: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct ChainSignature {
    pub signature: String,
    pub intent_id: String,
    pub timestamp: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct MetaOrder {
    pub order_id: String,
    pub user: AccountId,
    pub event_id: String,
    pub amount: u128,
    pub outcome: bool,
    pub intent_id: String,
    pub signature: String,
    pub is_executed: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct SolverConfig {
    pub solver_address: AccountId,
    pub min_quote_amount: u128,
    pub max_quote_amount: u128,
    pub fee_percentage: u64,
    pub tee_config: TEEConfig,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct TEEConfig {
    pub enclave_id: String,
    pub attestation: String,
    pub is_verified: bool,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct BetSwapAI {
    pub bet_events: UnorderedMap<String, BetEvent>,
    pub cross_chain_bets: UnorderedMap<String, CrossChainBet>,
    pub user_rewards: LookupMap<AccountId, u128>,
    pub ai_predictions: UnorderedMap<String, AIOutcomePrediction>,
    pub bet_intents: UnorderedMap<String, BetSwapIntent>,
    pub meta_orders: UnorderedMap<String, MetaOrder>,
    pub solvers: UnorderedMap<AccountId, SolverConfig>,
    pub solver_reputation: LookupMap<AccountId, u64>,
    pub quote_requests: UnorderedMap<String, String>,
    pub order_counter: u64,
    pub quote_counter: u64,
}

#[near_bindgen]
impl BetSwapAI {
    #[init]
    pub fn new() -> Self {
        Self {
            bet_events: UnorderedMap::new(b"bet_events"),
            cross_chain_bets: UnorderedMap::new(b"cross_chain_bets"),
            user_rewards: LookupMap::new(b"user_rewards"),
            ai_predictions: UnorderedMap::new(b"ai_predictions"),
            bet_intents: UnorderedMap::new(b"bet_intents"),
            meta_orders: UnorderedMap::new(b"meta_orders"),
            solvers: UnorderedMap::new(b"solvers"),
            solver_reputation: LookupMap::new(b"solver_reputation"),
            quote_requests: UnorderedMap::new(b"quote_requests"),
            order_counter: 0,
            quote_counter: 0,
        }
    }

    // Create a new betting event
    pub fn create_bet_event(&mut self, event_id: String, description: String, end_time: U64) {
        let event = BetEvent {
            description,
            end_time: end_time.0,
            resolved: false,
            outcome: false,
            total_bets: 0,
            user_bets: LookupMap::new(b"user_bets"),
        };
        
        self.bet_events.insert(&event_id, &event);
        env::log_str(&format!("Bet event created: {}", event_id));
    }

    // Place a bet on an event
    pub fn place_bet(&mut self, event_id: String, amount: U128, outcome: bool) {
        let mut event = self.bet_events.get(&event_id).expect("Event not found");
        require!(!event.resolved, "Event already resolved");
        require!(amount.0 > 0, "Amount must be greater than 0");
        
        // In a real implementation, you'd transfer tokens here
        event.user_bets.insert(&env::predecessor_account_id(), &amount.0);
        event.total_bets += amount.0;
        
        self.bet_events.insert(&event_id, &event);
        
        // Distribute rewards
        let current_reward = self.user_rewards.get(&env::predecessor_account_id()).unwrap_or(0);
        self.user_rewards.insert(&env::predecessor_account_id(), &(current_reward + amount.0 / 100));
        
        env::log_str(&format!("Bet placed: {} for event {}", amount.0, event_id));
    }

    // Place a cross-chain bet
    pub fn place_cross_chain_bet(
        &mut self,
        event_id: String,
        amount: U128,
        outcome: bool,
        eth_address: String,
    ) -> String {
        let bet_id = format!("{}_{}_{}", event_id, env::predecessor_account_id(), env::block_timestamp());
        
        let cross_chain_bet = CrossChainBet {
            user: env::predecessor_account_id(),
            event_id: event_id.clone(),
            amount: amount.0,
            outcome,
            is_cross_chain: true,
            eth_address,
            completed: false,
        };
        
        self.cross_chain_bets.insert(&bet_id, &cross_chain_bet);
        
        // Create bet intent for cross-chain swap
        let intent_id = format!("intent_{}", bet_id);
        let bet_intent = BetSwapIntent {
            user: env::predecessor_account_id(),
            event_id,
            amount: amount.0,
            outcome,
            target_chain: "ETH".to_string(),
            deadline: env::block_timestamp() + 3600, // 1 hour
        };
        
        self.bet_intents.insert(&intent_id, &bet_intent);
        
        env::log_str(&format!("Cross-chain bet placed: {}", bet_id));
        bet_id
    }

    // AI-driven outcome prediction
    pub fn predict_outcome_with_ai(&mut self, event_id: String, oracle_data: String) -> AIOutcomePrediction {
        // Simulate AI analysis of oracle data
        let predicted_outcome = self._analyze_oracle_data(&oracle_data);
        let confidence = self._calculate_confidence(&oracle_data);
        
        let prediction = AIOutcomePrediction {
            event_id: event_id.clone(),
            predicted_outcome,
            confidence,
            oracle_data,
            timestamp: env::block_timestamp(),
        };
        
        self.ai_predictions.insert(&event_id, &prediction);
        
        // Resolve the bet event
        if let Some(mut event) = self.bet_events.get(&event_id) {
            event.resolved = true;
            event.outcome = predicted_outcome;
            self.bet_events.insert(&event_id, &event);
        }
        
        env::log_str(&format!("AI prediction: {} -> {} (confidence: {})", event_id, predicted_outcome, confidence));
        prediction
    }

    // Register a solver for cross-chain swaps
    pub fn register_solver(
        &mut self,
        solver_address: AccountId,
        min_quote_amount: U128,
        max_quote_amount: U128,
        fee_percentage: U64,
        tee_config: TEEConfig,
    ) {
        let config = SolverConfig {
            solver_address: solver_address.clone(),
            min_quote_amount: min_quote_amount.0,
            max_quote_amount: max_quote_amount.0,
            fee_percentage: fee_percentage.0,
            tee_config,
        };
        
        self.solvers.insert(&solver_address, &config);
        self.solver_reputation.insert(&solver_address, &100); // Initial reputation
        
        env::log_str(&format!("Solver registered: {}", solver_address));
    }

    // Request a quote for cross-chain bet swap
    pub fn request_bet_swap_quote(
        &mut self,
        from_token: String,
        to_token: String,
        from_amount: U128,
        deadline: U64,
    ) -> String {
        self.quote_counter += 1;
        let request_id = format!("quote_{}", self.quote_counter);
        
        let quote_request = format!("{}:{}:{}:{}", from_token, to_token, from_amount.0, deadline.0);
        self.quote_requests.insert(&request_id, &quote_request);
        
        env::log_str(&format!("Quote requested: {}", request_id));
        request_id
    }

    // Generate quote and create meta-order (called by solver)
    pub fn generate_bet_swap_quote(
        &mut self,
        request_id: String,
        to_amount: U128,
        intent_id: String,
        signature: String,
    ) -> String {
        self.order_counter += 1;
        let order_id = format!("order_{}", self.order_counter);
        
        let meta_order = MetaOrder {
            order_id: order_id.clone(),
            user: env::predecessor_account_id(),
            event_id: "".to_string(), // Will be set from intent
            amount: to_amount.0,
            outcome: false,
            intent_id,
            signature,
            is_executed: false,
        };
        
        self.meta_orders.insert(&order_id, &meta_order);
        
        // Update solver reputation
        let current_reputation = self.solver_reputation.get(&env::predecessor_account_id()).unwrap_or(0);
        self.solver_reputation.insert(&env::predecessor_account_id(), &(current_reputation + 10));
        
        env::log_str(&format!("Meta-order created: {}", order_id));
        order_id
    }

    // Execute meta-order
    pub fn execute_bet_meta_order(&mut self, order_id: String, secret: String) {
        if let Some(mut order) = self.meta_orders.get(&order_id) {
            // Verify NEAR Chain Signature (mocked)
            require!(self._verify_near_signature(&order.signature, &order.intent_id), "Invalid signature");
            
            order.is_executed = true;
            self.meta_orders.insert(&order_id, &order);
            
            // Update solver reputation
            let current_reputation = self.solver_reputation.get(&env::predecessor_account_id()).unwrap_or(0);
            self.solver_reputation.insert(&env::predecessor_account_id(), &(current_reputation + 20));
            
            env::log_str(&format!("Meta-order executed: {}", order_id));
        }
    }

    // Claim rewards
    pub fn claim_rewards(&mut self) -> U128 {
        let reward = self.user_rewards.get(&env::predecessor_account_id()).unwrap_or(0);
        require!(reward > 0, "No rewards to claim");
        
        self.user_rewards.insert(&env::predecessor_account_id(), &0);
        
        env::log_str(&format!("Rewards claimed: {}", reward));
        U128(reward)
    }

    // Getter functions
    pub fn get_bet_event(&self, event_id: String) -> Option<BetEvent> {
        self.bet_events.get(&event_id)
    }

    pub fn get_user_bet(&self, event_id: String, user: AccountId) -> U128 {
        if let Some(event) = self.bet_events.get(&event_id) {
            U128(event.user_bets.get(&user).unwrap_or(0))
        } else {
            U128(0)
        }
    }

    pub fn get_user_rewards(&self, user: AccountId) -> U128 {
        U128(self.user_rewards.get(&user).unwrap_or(0))
    }

    pub fn get_solver_reputation(&self, solver: AccountId) -> U64 {
        U64(self.solver_reputation.get(&solver).unwrap_or(0))
    }

    pub fn get_ai_prediction(&self, event_id: String) -> Option<AIOutcomePrediction> {
        self.ai_predictions.get(&event_id)
    }

    // Internal helper functions
    fn _analyze_oracle_data(&self, oracle_data: &String) -> bool {
        // Simulate AI analysis - in production, this would use actual ML models
        // For demo, we'll use a simple hash-based prediction
        let hash = env::sha256(oracle_data.as_bytes());
        hash[0] % 2 == 0
    }

    fn _calculate_confidence(&self, oracle_data: &String) -> u64 {
        // Simulate confidence calculation
        let hash = env::sha256(oracle_data.as_bytes());
        ((hash[1] as u64) * 100) / 255
    }

    fn _verify_near_signature(&self, signature: &String, intent_id: &String) -> bool {
        // Mock signature verification - in production, this would verify actual NEAR Chain Signatures
        signature.len() > 0 && intent_id.len() > 0
    }
}

// Helper function for requirements
fn require!(condition: bool, message: &str) {
    if !condition {
        env::panic_str(message);
    }
} 