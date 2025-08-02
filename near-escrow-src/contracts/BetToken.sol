// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BetToken is ERC20, Ownable {
    mapping(bytes32 => bool) public betEvents;
    mapping(bytes32 => mapping(address => uint256)) public userBets;
    mapping(bytes32 => uint256) public totalBets;
    mapping(bytes32 => bool) public eventResolved;
    mapping(bytes32 => bool) public eventOutcome;
    
    event BetPlaced(bytes32 indexed eventId, address indexed user, uint256 amount, bool outcome);
    event EventCreated(bytes32 indexed eventId, string description, uint256 endTime);
    event EventResolved(bytes32 indexed eventId, bool outcome);
    event PayoutDistributed(bytes32 indexed eventId, address indexed user, uint256 amount);

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

        _transfer(msg.sender, address(this), amount);
        userBets[eventId][msg.sender] += amount;
        totalBets[eventId] += amount;

        emit BetPlaced(eventId, msg.sender, amount, outcome);
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
        
        // Simple payout logic - winners get proportional share
        if (eventOutcome[eventId]) {
            uint256 payout = userBetAmount * 2; // 2x payout for winners
            _transfer(address(this), msg.sender, payout);
            emit PayoutDistributed(eventId, msg.sender, payout);
        }
    }

    function getEventInfo(bytes32 eventId) external view returns (
        bool exists,
        bool resolved,
        bool outcome,
        uint256 totalBetAmount
    ) {
        return (
            betEvents[eventId],
            eventResolved[eventId],
            eventOutcome[eventId],
            totalBets[eventId]
        );
    }

    function getUserBet(bytes32 eventId, address user) external view returns (uint256) {
        return userBets[eventId][user];
    }
} 