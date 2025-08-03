// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BetToken is ERC20, Ownable {
    mapping(bytes32 => bool) public betEvents;
    mapping(bytes32 => mapping(address => uint256)) public userBets;
    mapping(bytes32 => uint256) public totalBets;
    mapping(bytes32 => uint256) public yesBets;
    mapping(bytes32 => uint256) public noBets;
    mapping(bytes32 => bool) public eventResolved;
    mapping(bytes32 => bool) public eventOutcome;
    
    // Dynamic odds parameters
    uint256 public constant MIN_ODDS = 100; // 1.00x minimum odds
    uint256 public constant MAX_ODDS = 1000; // 10.00x maximum odds
    uint256 public constant HOUSE_EDGE = 50; // 0.5% house edge (basis points)
    uint256 public constant LIQUIDITY_FEE = 25; // 0.25% liquidity fee (basis points)
    
    event BetPlaced(bytes32 indexed eventId, address indexed user, uint256 amount, bool outcome, uint256 odds);
    event EventCreated(bytes32 indexed eventId, string description, uint256 endTime);
    event EventResolved(bytes32 indexed eventId, bool outcome);
    event PayoutDistributed(bytes32 indexed eventId, address indexed user, uint256 amount);
    event OddsUpdated(bytes32 indexed eventId, uint256 yesOdds, uint256 noOdds);

    constructor() ERC20("BetSwap Token", "BET") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**decimals()); // 1M tokens
    }

    function createBetEvent(
        bytes32 eventId,
        string memory description,
        uint256 endTime
    ) external onlyOwner {
        require(!betEvents[eventId], "Event already exists");
        require(endTime > block.timestamp, "End time must be in future");
        
        betEvents[eventId] = true;
        emit EventCreated(eventId, description, endTime);
    }

    function placeBet(bytes32 eventId, uint256 amount, bool outcome) external {
        require(betEvents[eventId], "Event does not exist");
        require(!eventResolved[eventId], "Event already resolved");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Calculate current odds before placing bet
        (uint256 yesOdds, uint256 noOdds) = calculateOdds(eventId);
        uint256 currentOdds = outcome ? yesOdds : noOdds;

        _transfer(msg.sender, address(this), amount);
        userBets[eventId][msg.sender] += amount;
        totalBets[eventId] += amount;
        
        // Update outcome-specific betting amounts
        if (outcome) {
            yesBets[eventId] += amount;
        } else {
            noBets[eventId] += amount;
        }

        // Calculate new odds after bet
        (uint256 newYesOdds, uint256 newNoOdds) = calculateOdds(eventId);
        
        emit BetPlaced(eventId, msg.sender, amount, outcome, currentOdds);
        emit OddsUpdated(eventId, newYesOdds, newNoOdds);
    }

    function calculateOdds(bytes32 eventId) public view returns (uint256 yesOdds, uint256 noOdds) {
        uint256 total = totalBets[eventId];
        uint256 yes = yesBets[eventId];
        uint256 no = noBets[eventId];
        
        if (total == 0) {
            // Initial odds when no bets placed
            return (150, 150); // 1.50x for both outcomes
        }
        
        // Calculate implied probabilities
        uint256 yesProbability = (yes * 10000) / total;
        uint256 noProbability = (no * 10000) / total;
        
        // Apply house edge and calculate odds
        uint256 houseEdgeMultiplier = 10000 - HOUSE_EDGE;
        
        if (yesProbability > 0) {
            yesOdds = (total * 10000 * houseEdgeMultiplier) / (yes * 10000);
        } else {
            yesOdds = MAX_ODDS; // Maximum odds when no yes bets
        }
        
        if (noProbability > 0) {
            noOdds = (total * 10000 * houseEdgeMultiplier) / (no * 10000);
        } else {
            noOdds = MAX_ODDS; // Maximum odds when no no bets
        }
        
        // Ensure odds are within bounds
        yesOdds = _clampOdds(yesOdds);
        noOdds = _clampOdds(noOdds);
    }

    function _clampOdds(uint256 odds) internal pure returns (uint256) {
        if (odds < MIN_ODDS) return MIN_ODDS;
        if (odds > MAX_ODDS) return MAX_ODDS;
        return odds;
    }

    function getCurrentOdds(bytes32 eventId, bool outcome) external view returns (uint256) {
        (uint256 yesOdds, uint256 noOdds) = calculateOdds(eventId);
        return outcome ? yesOdds : noOdds;
    }

    function getBettingStats(bytes32 eventId) external view returns (
        uint256 total,
        uint256 yes,
        uint256 no,
        uint256 yesOdds,
        uint256 noOdds
    ) {
        (yesOdds, noOdds) = calculateOdds(eventId);
        return (
            totalBets[eventId],
            yesBets[eventId],
            noBets[eventId],
            yesOdds,
            noOdds
        );
    }

    function calculatePotentialPayout(bytes32 eventId, uint256 amount, bool outcome) external view returns (uint256) {
        (uint256 yesOdds, uint256 noOdds) = calculateOdds(eventId);
        uint256 odds = outcome ? yesOdds : noOdds;
        return (amount * odds) / 100;
    }

    function resolveEvent(bytes32 eventId, bool outcome) external onlyOwner {
        require(betEvents[eventId], "Event does not exist");
        require(!eventResolved[eventId], "Event already resolved");
        
        eventResolved[eventId] = true;
        eventOutcome[eventId] = outcome;
        
        emit EventResolved(eventId, outcome);
    }

    function claimPayout(bytes32 eventId) external {
        require(eventResolved[eventId], "Event not resolved");
        require(userBets[eventId][msg.sender] > 0, "No bet to claim");
        
        uint256 userBetAmount = userBets[eventId][msg.sender];
        userBets[eventId][msg.sender] = 0;
        
        // Dynamic payout based on outcome
        if (eventOutcome[eventId]) {
            // Calculate payout for yes winners
            uint256 totalYesBets = yesBets[eventId];
            if (totalYesBets > 0) {
                uint256 payout = (userBetAmount * totalBets[eventId]) / totalYesBets;
                // Apply liquidity fee
                payout = (payout * (10000 - LIQUIDITY_FEE)) / 10000;
                _transfer(address(this), msg.sender, payout);
                emit PayoutDistributed(eventId, msg.sender, payout);
            }
        } else {
            // Calculate payout for no winners
            uint256 totalNoBets = noBets[eventId];
            if (totalNoBets > 0) {
                uint256 payout = (userBetAmount * totalBets[eventId]) / totalNoBets;
                // Apply liquidity fee
                payout = (payout * (10000 - LIQUIDITY_FEE)) / 10000;
                _transfer(address(this), msg.sender, payout);
                emit PayoutDistributed(eventId, msg.sender, payout);
            }
        }
    }

    function getEventInfo(bytes32 eventId) external view returns (
        bool exists,
        bool resolved,
        bool outcome,
        uint256 totalBetAmount,
        uint256 yesBetAmount,
        uint256 noBetAmount
    ) {
        return (
            betEvents[eventId],
            eventResolved[eventId],
            eventOutcome[eventId],
            totalBets[eventId],
            yesBets[eventId],
            noBets[eventId]
        );
    }

    function getUserBet(bytes32 eventId, address user) external view returns (uint256) {
        return userBets[eventId][user];
    }
} 