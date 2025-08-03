// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HTLC.sol";
import "./DutchAuction.sol";
import "./ShadeAgentSolver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BetSwapAI {
    IERC20 public usdcToken;
    HTLC public htlcContract;
    DutchAuction public dutchAuctionContract;
    ShadeAgentSolver public solverContract;
    
    mapping(bytes32 => BetEvent) public betEvents;
    mapping(bytes32 => CrossChainBet) public crossChainBets;
    mapping(address => uint256) public userRewards;
    
    struct BetEvent {
        string description;
        uint256 endTime;
        bool resolved;
        bool outcome;
        uint256 totalBets;
        mapping(address => uint256) userBets;
    }
    
    struct CrossChainBet {
        address user;
        bytes32 eventId;
        uint256 amount;
        bool outcome;
        bool isCrossChain;
        string nearAccountId;
        bool completed;
    }
    
    event BetEventCreated(bytes32 indexed eventId, string description, uint256 endTime);
    event CrossChainBetPlaced(bytes32 indexed betId, address indexed user, bytes32 eventId, uint256 amount, bool outcome);
    event BetResolved(bytes32 indexed eventId, bool outcome);
    event CrossChainSwapInitiated(bytes32 indexed betId, bytes32 escrowId);
    event AIOutcomePrediction(bytes32 indexed eventId, bool predictedOutcome, uint256 confidence);
    event RewardDistributed(address indexed user, uint256 amount);
    
    constructor(
        address _usdcToken,
        address _htlcContract,
        address _dutchAuctionContract,
        address _solverContract
    ) {
        usdcToken = IERC20(_usdcToken);
        htlcContract = HTLC(_htlcContract);
        dutchAuctionContract = DutchAuction(_dutchAuctionContract);
        solverContract = ShadeAgentSolver(_solverContract);
    }
    
    function createBetEvent(
        bytes32 eventId,
        string memory description,
        uint256 endTime
    ) external {
        require(!betEvents[eventId].resolved, "Event already exists");
        require(endTime > block.timestamp, "End time must be in future");
        
        betEvents[eventId].description = description;
        betEvents[eventId].endTime = endTime;
        betEvents[eventId].resolved = false;
        
        emit BetEventCreated(eventId, description, endTime);
    }
    
    function placeBet(
        bytes32 eventId,
        uint256 amount,
        bool outcome
    ) external {
        require(betEvents[eventId].endTime > 0, "Event does not exist");
        require(!betEvents[eventId].resolved, "Event already resolved");
        require(amount > 0, "Amount must be greater than 0");
        require(usdcToken.balanceOf(msg.sender) >= amount, "Insufficient USDC balance");
        
        usdcToken.transferFrom(msg.sender, address(this), amount);
        betEvents[eventId].userBets[msg.sender] += amount;
        betEvents[eventId].totalBets += amount;
        
        // Distribute rewards for betting
        userRewards[msg.sender] += amount / 100; // 1% reward
    }
    
    function placeCrossChainBet(
        bytes32 eventId,
        uint256 amount,
        bool outcome,
        string memory nearAccountId
    ) external returns (bytes32 betId) {
        require(betEvents[eventId].endTime > 0, "Event does not exist");
        require(!betEvents[eventId].resolved, "Event already resolved");
        require(amount > 0, "Amount must be greater than 0");
        require(usdcToken.balanceOf(msg.sender) >= amount, "Insufficient USDC balance");
        
        betId = keccak256(abi.encodePacked(eventId, msg.sender, block.timestamp));
        
        crossChainBets[betId] = CrossChainBet({
            user: msg.sender,
            eventId: eventId,
            amount: amount,
            outcome: outcome,
            isCrossChain: true,
            nearAccountId: nearAccountId,
            completed: false
        });
        
        usdcToken.transferFrom(msg.sender, address(this), amount);
        betEvents[eventId].userBets[msg.sender] += amount;
        betEvents[eventId].totalBets += amount;
        
        emit CrossChainBetPlaced(betId, msg.sender, eventId, amount, outcome);
        
        // Initiate cross-chain swap
        _initiateCrossChainSwap(betId, amount, nearAccountId);
    }
    
    function _initiateCrossChainSwap(
        bytes32 betId,
        uint256 amount,
        string memory nearAccountId
    ) internal {
        // Create escrow for cross-chain swap
        bytes32 escrowId = keccak256(abi.encodePacked(betId, "cross_chain"));
        string memory secret = _generateSecret();
        bytes32 hashlock = keccak256(abi.encodePacked(secret));
        uint256 timelock = 7200; // 2 hours
        
        // Approve HTLC contract to spend USDC tokens
        usdcToken.approve(address(htlcContract), amount);
        
        // Create HTLC lock
        htlcContract.createLock(
            escrowId,
            msg.sender,
            address(usdcToken),
            amount,
            hashlock,
            timelock
        );
        
        emit CrossChainSwapInitiated(betId, escrowId);
    }
    
    function resolveBetWithAI(
        bytes32 eventId,
        bool outcome,
        uint256 confidence
    ) external {
        require(betEvents[eventId].endTime > 0, "Event does not exist");
        require(!betEvents[eventId].resolved, "Event already resolved");
        require(block.timestamp >= betEvents[eventId].endTime, "Event not ended yet");
        
        betEvents[eventId].resolved = true;
        betEvents[eventId].outcome = outcome;
        
        emit BetResolved(eventId, outcome);
        emit AIOutcomePrediction(eventId, outcome, confidence);
        
        // Distribute rewards to winners
        _distributeRewards(eventId, outcome);
    }
    
    function _distributeRewards(bytes32 eventId, bool outcome) internal {
        // Simple reward distribution - winners get additional USDC
        uint256 totalReward = betEvents[eventId].totalBets / 10; // 10% of total bets as reward
        
        // In a real implementation, you'd iterate through all users and distribute proportionally
        // For demo purposes, we'll just emit the event
        emit RewardDistributed(address(0), totalReward);
    }
    
    function claimRewards() external {
        uint256 reward = userRewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        userRewards[msg.sender] = 0;
        usdcToken.transfer(msg.sender, reward);
        
        emit RewardDistributed(msg.sender, reward);
    }
    
    function getBetEventInfo(bytes32 eventId) external view returns (
        string memory description,
        uint256 endTime,
        bool resolved,
        bool outcome,
        uint256 totalBets
    ) {
        BetEvent storage event_ = betEvents[eventId];
        return (
            event_.description,
            event_.endTime,
            event_.resolved,
            event_.outcome,
            event_.totalBets
        );
    }
    
    function getUserBet(bytes32 eventId, address user) external view returns (uint256) {
        return betEvents[eventId].userBets[user];
    }
    
    function getUserRewards(address user) external view returns (uint256) {
        return userRewards[user];
    }
    
    function _generateSecret() internal view returns (string memory) {
        // In production, use a more secure random generation
        return string(abi.encodePacked(block.timestamp, msg.sender));
    }
} 