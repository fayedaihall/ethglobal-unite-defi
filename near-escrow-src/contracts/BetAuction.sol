// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HTLC.sol";

contract BetAuction {
    struct BetAuction {
        address seller;
        uint256 eventId;
        bool betOutcome; // true for "Yes", false for "No"
        uint256 betAmount;
        uint256 startPrice;
        uint256 currentPrice;
        uint256 minPrice;
        uint256 startTime;
        uint256 duration;
        uint256 stepTime;
        uint256 stepAmount;
        bool active;
        bool sold;
        address buyer;
        bytes32 escrowId;
        uint256 filledAmount; // Track partial fills
        uint256 remainingAmount; // Track remaining amount
        string eventTitle;
        string eventDescription;
        uint256 eventEndTime;
        bool eventResolved;
        bool eventOutcome;
    }

    mapping(uint256 => BetAuction) public betAuctions;
    uint256 public auctionCounter;
    address public htlcContract;
    address public usdcToken;
    address public betSwapAIContract;

    event BetAuctionCreated(
        uint256 indexed auctionId, 
        address indexed seller, 
        uint256 eventId,
        bool betOutcome,
        uint256 betAmount,
        uint256 startPrice,
        uint256 minPrice,
        uint256 duration,
        string eventTitle
    );
    event BetBidPlaced(uint256 indexed auctionId, address indexed buyer, uint256 amount, bytes32 escrowId);
    event BetPartialFill(uint256 indexed auctionId, address indexed buyer, uint256 filledAmount, uint256 remainingAmount);
    event BetAuctionCompleted(uint256 indexed auctionId, address indexed buyer, uint256 totalAmount);

    constructor(address _htlcContract, address _usdcToken, address _betSwapAIContract) {
        htlcContract = _htlcContract;
        usdcToken = _usdcToken;
        betSwapAIContract = _betSwapAIContract;
    }

    function createBetAuction(
        uint256 eventId,
        bool betOutcome,
        uint256 betAmount,
        uint256 startPrice,
        uint256 minPrice,
        uint256 duration,
        uint256 stepTime,
        uint256 stepAmount,
        string memory eventTitle,
        string memory eventDescription,
        uint256 eventEndTime
    ) external returns (uint256) {
        require(startPrice > minPrice, "Start price must be greater than min price");
        require(duration > 0, "Duration must be greater than 0");
        require(stepTime > 0, "Step time must be greater than 0");
        require(stepAmount > 0, "Step amount must be greater than 0");
        require(betAmount > 0, "Bet amount must be greater than 0");

        uint256 auctionId = auctionCounter++;
        
        betAuctions[auctionId] = BetAuction({
            seller: msg.sender,
            eventId: eventId,
            betOutcome: betOutcome,
            betAmount: betAmount,
            startPrice: startPrice,
            currentPrice: startPrice,
            minPrice: minPrice,
            startTime: block.timestamp,
            duration: duration,
            stepTime: stepTime,
            stepAmount: stepAmount,
            active: true,
            sold: false,
            buyer: address(0),
            escrowId: bytes32(0),
            filledAmount: 0,
            remainingAmount: betAmount,
            eventTitle: eventTitle,
            eventDescription: eventDescription,
            eventEndTime: eventEndTime,
            eventResolved: false,
            eventOutcome: false
        });

        emit BetAuctionCreated(
            auctionId, 
            msg.sender, 
            eventId, 
            betOutcome, 
            betAmount, 
            startPrice, 
            minPrice, 
            duration,
            eventTitle
        );
        return auctionId;
    }

    function getCurrentPrice(uint256 auctionId) public view returns (uint256) {
        BetAuction storage auction = betAuctions[auctionId];
        require(auction.active, "Auction not active");

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 steps = elapsed / auction.stepTime;
        uint256 priceReduction = steps * auction.stepAmount;
        
        if (priceReduction >= auction.startPrice - auction.minPrice) {
            return auction.minPrice;
        }
        
        return auction.startPrice - priceReduction;
    }

    function placeBetBid(uint256 auctionId, bytes32 escrowId, uint256 fillAmount) external {
        BetAuction storage auction = betAuctions[auctionId];
        require(auction.active, "Auction not active");
        require(auction.remainingAmount > 0, "Auction fully filled");
        require(fillAmount > 0, "Fill amount must be greater than 0");
        require(fillAmount <= auction.remainingAmount, "Fill amount exceeds remaining amount");

        uint256 currentPrice = getCurrentPrice(auctionId);
        uint256 totalCost = currentPrice * fillAmount / 1e6; // Convert from 6 decimals

        // Transfer USDC from buyer to contract
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), totalCost), "USDC transfer failed");

        // Update auction state
        auction.filledAmount += fillAmount;
        auction.remainingAmount -= fillAmount;
        auction.currentPrice = getCurrentPrice(auctionId);

        // If this is the first bid, set the buyer
        if (auction.buyer == address(0)) {
            auction.buyer = msg.sender;
        }

        // If auction is fully filled, mark as sold
        if (auction.remainingAmount == 0) {
            auction.sold = true;
            auction.active = false;
            emit BetAuctionCompleted(auctionId, msg.sender, auction.filledAmount);
        } else {
            emit BetPartialFill(auctionId, msg.sender, fillAmount, auction.remainingAmount);
        }

        emit BetBidPlaced(auctionId, msg.sender, totalCost, escrowId);
    }

    function placeBetBid(uint256 auctionId, bytes32 escrowId) external {
        BetAuction storage auction = betAuctions[auctionId];
        require(auction.active, "Auction not active");
        require(auction.remainingAmount > 0, "Auction fully filled");

        // Default to filling the entire remaining amount
        this.placeBetBid(auctionId, escrowId, auction.remainingAmount);
    }

    function cancelBetAuction(uint256 auctionId) external {
        BetAuction storage auction = betAuctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.active, "Auction not active");
        require(auction.filledAmount == 0, "Cannot cancel auction with fills");

        auction.active = false;
    }

    function withdrawBetProceeds(uint256 auctionId) external {
        BetAuction storage auction = betAuctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can withdraw");
        require(auction.filledAmount > 0, "No proceeds to withdraw");

        uint256 totalProceeds = calculateBetTotalProceeds(auctionId);
        require(IERC20(usdcToken).transfer(msg.sender, totalProceeds), "USDC transfer failed");
    }

    function calculateBetTotalProceeds(uint256 auctionId) public view returns (uint256) {
        BetAuction storage auction = betAuctions[auctionId];
        // This is a simplified calculation - in practice you'd track individual fill prices
        uint256 avgPrice = (auction.startPrice + auction.minPrice) / 2;
        return auction.filledAmount * avgPrice / 1e6;
    }

    // Individual getter functions to avoid stack too deep
    function getBetAuctionSeller(uint256 auctionId) external view returns (address) {
        return betAuctions[auctionId].seller;
    }
    function getBetAuctionEventId(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].eventId;
    }
    function getBetAuctionOutcome(uint256 auctionId) external view returns (bool) {
        return betAuctions[auctionId].betOutcome;
    }
    function getBetAuctionAmount(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].betAmount;
    }
    function getBetAuctionStartPrice(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].startPrice;
    }
    function getBetAuctionCurrentPrice(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].currentPrice;
    }
    function getBetAuctionMinPrice(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].minPrice;
    }
    function getBetAuctionStartTime(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].startTime;
    }
    function getBetAuctionDuration(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].duration;
    }
    function getBetAuctionStepTime(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].stepTime;
    }
    function getBetAuctionStepAmount(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].stepAmount;
    }
    function getBetAuctionActive(uint256 auctionId) external view returns (bool) {
        return betAuctions[auctionId].active;
    }
    function getBetAuctionSold(uint256 auctionId) external view returns (bool) {
        return betAuctions[auctionId].sold;
    }
    function getBetAuctionBuyer(uint256 auctionId) external view returns (address) {
        return betAuctions[auctionId].buyer;
    }
    function getBetAuctionEscrowId(uint256 auctionId) external view returns (bytes32) {
        return betAuctions[auctionId].escrowId;
    }
    function getBetAuctionFilledAmount(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].filledAmount;
    }
    function getBetAuctionRemainingAmount(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].remainingAmount;
    }
    function getBetAuctionEventTitle(uint256 auctionId) external view returns (string memory) {
        return betAuctions[auctionId].eventTitle;
    }
    function getBetAuctionEventDescription(uint256 auctionId) external view returns (string memory) {
        return betAuctions[auctionId].eventDescription;
    }
    function getBetAuctionEventEndTime(uint256 auctionId) external view returns (uint256) {
        return betAuctions[auctionId].eventEndTime;
    }
    function getBetAuctionEventResolved(uint256 auctionId) external view returns (bool) {
        return betAuctions[auctionId].eventResolved;
    }
    function getBetAuctionEventOutcome(uint256 auctionId) external view returns (bool) {
        return betAuctions[auctionId].eventOutcome;
    }

    // Get complete auction info
    function getBetAuctionInfo(uint256 auctionId) external view returns (
        address seller,
        uint256 eventId,
        bool betOutcome,
        uint256 betAmount,
        uint256 startPrice,
        uint256 currentPrice,
        uint256 minPrice,
        uint256 startTime,
        uint256 duration,
        uint256 stepTime,
        uint256 stepAmount,
        bool active,
        bool sold,
        address buyer,
        bytes32 escrowId,
        uint256 filledAmount,
        uint256 remainingAmount,
        string memory eventTitle,
        string memory eventDescription,
        uint256 eventEndTime,
        bool eventResolved,
        bool eventOutcome
    ) {
        BetAuction storage auction = betAuctions[auctionId];
        return (
            auction.seller,
            auction.eventId,
            auction.betOutcome,
            auction.betAmount,
            auction.startPrice,
            auction.currentPrice,
            auction.minPrice,
            auction.startTime,
            auction.duration,
            auction.stepTime,
            auction.stepAmount,
            auction.active,
            auction.sold,
            auction.buyer,
            auction.escrowId,
            auction.filledAmount,
            auction.remainingAmount,
            auction.eventTitle,
            auction.eventDescription,
            auction.eventEndTime,
            auction.eventResolved,
            auction.eventOutcome
        );
    }
} 