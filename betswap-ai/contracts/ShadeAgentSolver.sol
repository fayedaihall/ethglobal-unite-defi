// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HTLC.sol";

/**
 * @title ShadeAgentSolver
 * @dev Decentralized solver for 1inch Fusion+ cross-chain swaps using NEAR's Shade Agent Framework
 * This solver listens for quote requests, generates valid 1inch Fusion meta-orders,
 * and executes them using NEAR's Chain Signatures in a Trusted Execution Environment
 */
contract ShadeAgentSolver {
    struct QuoteRequest {
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 deadline;
        bytes32 intentId;
        bool isExecuted;
    }

    struct MetaOrder {
        bytes32 orderId;
        address fromToken;
        address toToken;
        uint256 fromAmount;
        uint256 toAmount;
        uint256 deadline;
        bytes32 intentId;
        bytes signature;
        bool isExecuted;
    }

    struct SolverConfig {
        address solverAddress;
        uint256 minQuoteAmount;
        uint256 maxQuoteAmount;
        uint256 feePercentage;
        bool isActive;
        uint256 reputation;
    }

    // State variables
    mapping(bytes32 => QuoteRequest) public quoteRequests;
    mapping(bytes32 => MetaOrder) public metaOrders;
    mapping(address => SolverConfig) public solvers;
    mapping(address => uint256) public solverReputation;
    
    address public htlcContract;
    address public usdcToken;
    address public owner;
    uint256 public quoteCounter;
    uint256 public orderCounter;
    
    // Events
    event QuoteRequested(
        bytes32 indexed requestId,
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 deadline
    );
    
    event QuoteGenerated(
        bytes32 indexed requestId,
        bytes32 indexed orderId,
        address indexed solver,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 fee
    );
    
    event MetaOrderExecuted(
        bytes32 indexed orderId,
        address indexed solver,
        bytes32 indexed intentId,
        bool success
    );
    
    event SolverRegistered(
        address indexed solver,
        uint256 minQuoteAmount,
        uint256 maxQuoteAmount,
        uint256 feePercentage
    );
    
    event SolverReputationUpdated(
        address indexed solver,
        uint256 newReputation
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlySolver() {
        require(solvers[msg.sender].isActive, "Only registered solvers can call this function");
        _;
    }

    constructor(address _htlcContract, address _usdcToken) {
        htlcContract = _htlcContract;
        usdcToken = _usdcToken;
        owner = msg.sender;
    }

    /**
     * @dev Register a new solver with configuration
     * @param solverAddress Address of the solver
     * @param minQuoteAmount Minimum quote amount
     * @param maxQuoteAmount Maximum quote amount
     * @param feePercentage Fee percentage (basis points)
     */
    function registerSolver(
        address solverAddress,
        uint256 minQuoteAmount,
        uint256 maxQuoteAmount,
        uint256 feePercentage
    ) external onlyOwner {
        require(solverAddress != address(0), "Invalid solver address");
        require(feePercentage <= 1000, "Fee percentage too high"); // Max 10%
        
        solvers[solverAddress] = SolverConfig({
            solverAddress: solverAddress,
            minQuoteAmount: minQuoteAmount,
            maxQuoteAmount: maxQuoteAmount,
            feePercentage: feePercentage,
            isActive: true,
            reputation: 1000 // Initial reputation
        });
        
        emit SolverRegistered(solverAddress, minQuoteAmount, maxQuoteAmount, feePercentage);
    }

    /**
     * @dev Request a quote for cross-chain swap
     * @param fromToken Source token address
     * @param toToken Destination token address
     * @param fromAmount Amount to swap
     * @param deadline Quote deadline
     * @return requestId Unique request identifier
     */
    function requestQuote(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 deadline
    ) external returns (bytes32 requestId) {
        require(fromToken != address(0), "Invalid from token address");
        require(fromAmount > 0, "Invalid amount");
        require(deadline > block.timestamp, "Invalid deadline");
        
        requestId = keccak256(abi.encodePacked(
            fromToken,
            toToken,
            fromAmount,
            deadline,
            quoteCounter
        ));
        
        quoteRequests[requestId] = QuoteRequest({
            fromToken: fromToken,
            toToken: toToken,
            fromAmount: fromAmount,
            toAmount: 0, // Will be set by solver
            deadline: deadline,
            intentId: bytes32(0),
            isExecuted: false
        });
        
        quoteCounter++;
        
        emit QuoteRequested(requestId, fromToken, toToken, fromAmount, 0, deadline);
    }

    /**
     * @dev Generate quote and create meta-order (called by solver)
     * @param requestId Quote request identifier
     * @param toAmount Calculated destination amount
     * @param intentId NEAR intent identifier
     * @param signature NEAR Chain Signature
     */
    function generateQuote(
        bytes32 requestId,
        uint256 toAmount,
        bytes32 intentId,
        bytes calldata signature
    ) external onlySolver {
        QuoteRequest storage request = quoteRequests[requestId];
        require(request.fromToken != address(0), "Request not found");
        require(block.timestamp <= request.deadline, "Quote expired");
        require(!request.isExecuted, "Request already executed");
        
        SolverConfig storage solver = solvers[msg.sender];
        require(toAmount >= solver.minQuoteAmount, "Quote too low");
        require(toAmount <= solver.maxQuoteAmount, "Quote too high");
        
        // Calculate fee
        uint256 fee = (toAmount * solver.feePercentage) / 10000;
        uint256 finalAmount = toAmount - fee;
        
        // Create meta-order
        bytes32 orderId = keccak256(abi.encodePacked(
            requestId,
            msg.sender,
            orderCounter
        ));
        
        metaOrders[orderId] = MetaOrder({
            orderId: orderId,
            fromToken: request.fromToken,
            toToken: request.toToken,
            fromAmount: request.fromAmount,
            toAmount: finalAmount,
            deadline: request.deadline,
            intentId: intentId,
            signature: signature,
            isExecuted: false
        });
        
        // Update request
        request.toAmount = finalAmount;
        request.intentId = intentId;
        
        orderCounter++;
        
        emit QuoteGenerated(requestId, orderId, msg.sender, request.fromAmount, finalAmount, fee);
    }

    /**
     * @dev Execute meta-order using NEAR Chain Signatures
     * @param orderId Meta-order identifier
     * @param secret HTLC secret for cross-chain execution
     */
    function executeMetaOrder(bytes32 orderId, string calldata secret) external {
        MetaOrder storage order = metaOrders[orderId];
        require(order.fromToken != address(0), "Order not found");
        require(block.timestamp <= order.deadline, "Order expired");
        require(!order.isExecuted, "Order already executed");
        
        // Verify NEAR Chain Signature
        require(verifyNearSignature(order.signature, order.intentId), "Invalid NEAR signature");
        
        // Create HTLC lock for cross-chain execution
        bytes32 hashlock = keccak256(abi.encodePacked(secret));
        uint256 timelock = block.timestamp + 7200; // 2 hours
        
        // Execute HTLC lock
        HTLC htlc = HTLC(htlcContract);
        htlc.createLock(
            orderId,
            msg.sender,
            order.fromToken,
            order.fromAmount,
            hashlock,
            timelock
        );
        
        // Mark order as executed
        order.isExecuted = true;
        
        // Update solver reputation
        updateSolverReputation(msg.sender, true);
        
        emit MetaOrderExecuted(orderId, msg.sender, order.intentId, true);
    }

    /**
     * @dev Verify NEAR Chain Signature (mock implementation)
     * @param signature NEAR signature
     * @param intentId Intent identifier
     * @return bool Verification result
     */
    function verifyNearSignature(bytes memory signature, bytes32 intentId) internal pure returns (bool) {
        // In production, this would verify the NEAR Chain Signature
        // For demo purposes, we'll accept any non-empty signature
        return signature.length > 0;
    }

    /**
     * @dev Update solver reputation based on performance
     * @param solverAddress Solver address
     * @param success Whether the execution was successful
     */
    function updateSolverReputation(address solverAddress, bool success) internal {
        SolverConfig storage solver = solvers[solverAddress];
        
        if (success) {
            solver.reputation = solver.reputation + 10; // Increase reputation
        } else {
            solver.reputation = solver.reputation > 10 ? solver.reputation - 10 : 0; // Decrease reputation
        }
        
        emit SolverReputationUpdated(solverAddress, solver.reputation);
    }

    /**
     * @dev Get quote request details
     * @param requestId Request identifier
     * @return QuoteRequest struct
     */
    function getQuoteRequest(bytes32 requestId) external view returns (QuoteRequest memory) {
        return quoteRequests[requestId];
    }

    /**
     * @dev Get meta-order details
     * @param orderId Order identifier
     * @return MetaOrder struct
     */
    function getMetaOrder(bytes32 orderId) external view returns (MetaOrder memory) {
        return metaOrders[orderId];
    }

    /**
     * @dev Get solver configuration
     * @param solverAddress Solver address
     * @return SolverConfig struct
     */
    function getSolverConfig(address solverAddress) external view returns (SolverConfig memory) {
        return solvers[solverAddress];
    }

    /**
     * @dev Deactivate solver (only owner)
     * @param solverAddress Solver address
     */
    function deactivateSolver(address solverAddress) external onlyOwner {
        require(solvers[solverAddress].isActive, "Solver not active");
        solvers[solverAddress].isActive = false;
    }

    /**
     * @dev Update solver configuration (only owner)
     * @param solverAddress Solver address
     * @param minQuoteAmount New minimum quote amount
     * @param maxQuoteAmount New maximum quote amount
     * @param feePercentage New fee percentage
     */
    function updateSolverConfig(
        address solverAddress,
        uint256 minQuoteAmount,
        uint256 maxQuoteAmount,
        uint256 feePercentage
    ) external onlyOwner {
        require(solvers[solverAddress].isActive, "Solver not active");
        require(feePercentage <= 1000, "Fee percentage too high");
        
        solvers[solverAddress].minQuoteAmount = minQuoteAmount;
        solvers[solverAddress].maxQuoteAmount = maxQuoteAmount;
        solvers[solverAddress].feePercentage = feePercentage;
    }
} 