use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, Balance, Gas, PanicOnDefault, Promise, PromiseResult};
use std::collections::HashMap;

/// Gas for cross-contract calls
const GAS_FOR_CROSS_CONTRACT_CALL: Gas = Gas(5_000_000_000_000);

/// NEAR Chain Signature verification
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct ChainSignature {
    pub signature: String,
    pub public_key: String,
    pub message: String,
}

/// 1inch Fusion+ Meta Order structure
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct MetaOrder {
    pub order_id: String,
    pub from_token: AccountId,
    pub to_token: AccountId,
    pub from_amount: U128,
    pub to_amount: U128,
    pub deadline: U64,
    pub intent_id: String,
    pub signature: ChainSignature,
    pub is_executed: bool,
}

/// Quote Request structure
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct QuoteRequest {
    pub request_id: String,
    pub from_token: AccountId,
    pub to_token: AccountId,
    pub from_amount: U128,
    pub to_amount: U128,
    pub deadline: U64,
    pub intent_id: String,
    pub is_executed: bool,
}

/// Solver configuration
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct SolverConfig {
    pub solver_address: AccountId,
    pub min_quote_amount: U128,
    pub max_quote_amount: U128,
    pub fee_percentage: u32,
    pub is_active: bool,
    pub reputation: u32,
}

/// Trusted Execution Environment (TEE) configuration
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct TEEConfig {
    pub tee_enclave_id: String,
    pub attestation_report: String,
    pub public_key: String,
    pub is_verified: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
pub struct Intent {
    pub intent_id: String,
    pub user_id: AccountId,
    pub from_token: AccountId,
    pub to_token: AccountId,
    pub from_amount: U128,
    pub to_amount: U128,
    pub deadline: U64,
    pub status: String, // "pending", "executed", "failed"
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ShadeAgentSolver {
    pub owner_id: AccountId,
    pub quote_requests: UnorderedMap<String, QuoteRequest>,
    pub meta_orders: UnorderedMap<String, MetaOrder>,
    pub solvers: UnorderedMap<AccountId, SolverConfig>,
    pub intents: UnorderedMap<String, Intent>,
    pub tee_configs: UnorderedMap<AccountId, TEEConfig>,
    pub quote_counter: u64,
    pub order_counter: u64,
    pub solver_reputation: UnorderedMap<AccountId, u32>,
}

#[near_bindgen]
impl ShadeAgentSolver {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            quote_requests: UnorderedMap::new(b"q"),
            meta_orders: UnorderedMap::new(b"m"),
            solvers: UnorderedMap::new(b"s"),
            intents: UnorderedMap::new(b"i"),
            tee_configs: UnorderedMap::new(b"t"),
            quote_counter: 0,
            order_counter: 0,
            solver_reputation: UnorderedMap::new(b"r"),
        }
    }

    /// Register a new solver with TEE configuration
    pub fn register_solver(
        &mut self,
        solver_address: AccountId,
        min_quote_amount: U128,
        max_quote_amount: U128,
        fee_percentage: u32,
        tee_config: TEEConfig,
    ) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only owner can register solvers");
        assert!(fee_percentage <= 1000, "Fee percentage too high"); // Max 10%

        // Verify TEE attestation
        assert!(self.verify_tee_attestation(&tee_config), "Invalid TEE attestation");

        let solver_config = SolverConfig {
            solver_address: solver_address.clone(),
            min_quote_amount,
            max_quote_amount,
            fee_percentage,
            is_active: true,
            reputation: 1000, // Initial reputation
        };

        self.solvers.insert(&solver_address, &solver_config);
        self.tee_configs.insert(&solver_address, &tee_config);
        self.solver_reputation.insert(&solver_address, &1000);
    }

    /// Request a quote for cross-chain swap
    pub fn request_quote(
        &mut self,
        from_token: AccountId,
        to_token: AccountId,
        from_amount: U128,
        deadline: U64,
    ) -> String {
        assert!(from_amount.0 > 0, "Invalid amount");
        assert!(deadline.0 > env::block_timestamp(), "Invalid deadline");

        let request_id = format!("quote_{}", self.quote_counter);
        self.quote_counter += 1;

        let quote_request = QuoteRequest {
            request_id: request_id.clone(),
            from_token,
            to_token,
            from_amount,
            to_amount: U128(0), // Will be set by solver
            deadline,
            intent_id: String::new(),
            is_executed: false,
        };

        self.quote_requests.insert(&request_id, &quote_request);

        // Emit event for solvers to listen
        env::log_str(&format!("Quote requested: {}", request_id));

        request_id
    }

    /// Generate quote and create meta-order (called by solver)
    pub fn generate_quote(
        &mut self,
        request_id: String,
        to_amount: U128,
        intent_id: String,
        signature: ChainSignature,
    ) -> String {
        let solver_id = env::predecessor_account_id();
        
        // Verify solver is registered and active
        let solver_config = self.solvers.get(&solver_id).expect("Solver not registered");
        assert!(solver_config.is_active, "Solver not active");

        // Verify TEE configuration
        let tee_config = self.tee_configs.get(&solver_id).expect("TEE config not found");
        assert!(tee_config.is_verified, "TEE not verified");

        let quote_request = self.quote_requests.get(&request_id).expect("Request not found");
        assert!(env::block_timestamp() <= quote_request.deadline.0, "Quote expired");
        assert!(!quote_request.is_executed, "Request already executed");

        // Validate quote amount
        assert!(to_amount.0 >= solver_config.min_quote_amount.0, "Quote too low");
        assert!(to_amount.0 <= solver_config.max_quote_amount.0, "Quote too high");

        // Calculate fee
        let fee = (to_amount.0 * solver_config.fee_percentage as u128) / 10000;
        let final_amount = to_amount.0 - fee;

        // Create meta-order
        let order_id = format!("order_{}", self.order_counter);
        self.order_counter += 1;

        let meta_order = MetaOrder {
            order_id: order_id.clone(),
            from_token: quote_request.from_token.clone(),
            to_token: quote_request.to_token.clone(),
            from_amount: quote_request.from_amount.clone(),
            to_amount: U128(final_amount),
            deadline: quote_request.deadline.clone(),
            intent_id: intent_id.clone(),
            signature,
            is_executed: false,
        };

        self.meta_orders.insert(&order_id, &meta_order);

        // Update quote request
        let mut updated_request = quote_request.clone();
        updated_request.to_amount = U128(final_amount);
        updated_request.intent_id = intent_id;
        self.quote_requests.insert(&request_id, &updated_request);

        // Create intent
        let intent = Intent {
            intent_id: intent_id.clone(),
            user_id: env::predecessor_account_id(),
            from_token: quote_request.from_token.clone(),
            to_token: quote_request.to_token.clone(),
            from_amount: quote_request.from_amount.clone(),
            to_amount: U128(final_amount),
            deadline: quote_request.deadline.clone(),
            status: "pending".to_string(),
        };

        self.intents.insert(&intent_id, &intent);

        env::log_str(&format!("Quote generated: {} -> {}", request_id, order_id));

        order_id
    }

    /// Execute meta-order using NEAR Chain Signatures
    pub fn execute_meta_order(&mut self, order_id: String, secret: String) -> bool {
        let meta_order = self.meta_orders.get(&order_id).expect("Order not found");
        assert!(env::block_timestamp() <= meta_order.deadline.0, "Order expired");
        assert!(!meta_order.is_executed, "Order already executed");

        // Verify NEAR Chain Signature
        assert!(self.verify_near_signature(&meta_order.signature, &meta_order.intent_id), "Invalid NEAR signature");

        // Execute cross-chain swap using HTLC
        let success = self.execute_cross_chain_swap(&meta_order, &secret);

        if success {
            // Mark order as executed
            let mut updated_order = meta_order.clone();
            updated_order.is_executed = true;
            self.meta_orders.insert(&order_id, &updated_order);

            // Update intent status
            let mut intent = self.intents.get(&meta_order.intent_id).expect("Intent not found");
            intent.status = "executed".to_string();
            self.intents.insert(&meta_order.intent_id, &intent);

            // Update solver reputation
            self.update_solver_reputation(&env::predecessor_account_id(), true);
        }

        env::log_str(&format!("Meta order executed: {} -> {}", order_id, success));

        success
    }

    /// Verify TEE attestation report
    fn verify_tee_attestation(&self, tee_config: &TEEConfig) -> bool {
        // In production, this would verify the TEE attestation report
        // For demo purposes, we'll accept any non-empty attestation
        !tee_config.attestation_report.is_empty()
    }

    /// Verify NEAR Chain Signature
    fn verify_near_signature(&self, signature: &ChainSignature, intent_id: &str) -> bool {
        // In production, this would verify the NEAR Chain Signature
        // For demo purposes, we'll accept any non-empty signature
        !signature.signature.is_empty() && !intent_id.is_empty()
    }

    /// Execute cross-chain swap using HTLC
    fn execute_cross_chain_swap(&self, meta_order: &MetaOrder, secret: &str) -> bool {
        // Create HTLC lock for cross-chain execution
        let hashlock = env::sha256(secret.as_bytes());
        let timelock = env::block_timestamp() + 7200000000000; // 2 hours in nanoseconds

        // In production, this would call the HTLC contract
        // For demo purposes, we'll simulate success
        env::log_str(&format!("HTLC lock created for order: {}", meta_order.order_id));

        true
    }

    /// Update solver reputation based on performance
    fn update_solver_reputation(&mut self, solver_address: &AccountId, success: bool) {
        let current_reputation = self.solver_reputation.get(solver_address).unwrap_or(1000);
        
        let new_reputation = if success {
            current_reputation + 10 // Increase reputation
        } else {
            if current_reputation > 10 {
                current_reputation - 10
            } else {
                0
            }
        };

        self.solver_reputation.insert(solver_address, &new_reputation);
    }

    /// Get quote request details
    pub fn get_quote_request(&self, request_id: String) -> Option<QuoteRequest> {
        self.quote_requests.get(&request_id)
    }

    /// Get meta-order details
    pub fn get_meta_order(&self, order_id: String) -> Option<MetaOrder> {
        self.meta_orders.get(&order_id)
    }

    /// Get solver configuration
    pub fn get_solver_config(&self, solver_address: AccountId) -> Option<SolverConfig> {
        self.solvers.get(&solver_address)
    }

    /// Get intent details
    pub fn get_intent(&self, intent_id: String) -> Option<Intent> {
        self.intents.get(&intent_id)
    }

    /// Deactivate solver (only owner)
    pub fn deactivate_solver(&mut self, solver_address: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only owner can deactivate solvers");
        
        if let Some(mut solver_config) = self.solvers.get(&solver_address) {
            solver_config.is_active = false;
            self.solvers.insert(&solver_address, &solver_config);
        }
    }

    /// Update solver configuration (only owner)
    pub fn update_solver_config(
        &mut self,
        solver_address: AccountId,
        min_quote_amount: U128,
        max_quote_amount: U128,
        fee_percentage: u32,
    ) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only owner can update solver config");
        assert!(fee_percentage <= 1000, "Fee percentage too high");

        if let Some(mut solver_config) = self.solvers.get(&solver_address) {
            solver_config.min_quote_amount = min_quote_amount;
            solver_config.max_quote_amount = max_quote_amount;
            solver_config.fee_percentage = fee_percentage;
            self.solvers.insert(&solver_address, &solver_config);
        }
    }

    /// Get solver reputation
    pub fn get_solver_reputation(&self, solver_address: AccountId) -> u32 {
        self.solver_reputation.get(&solver_address).unwrap_or(0)
    }

    /// List all active solvers
    pub fn get_active_solvers(&self) -> Vec<AccountId> {
        let mut active_solvers = Vec::new();
        for (solver_address, config) in self.solvers.iter() {
            if config.is_active {
                active_solvers.push(solver_address);
            }
        }
        active_solvers
    }

    /// Get quote statistics
    pub fn get_quote_stats(&self) -> (u64, u64) {
        let total_requests = self.quote_counter;
        let total_orders = self.order_counter;
        (total_requests, total_orders)
    }
}