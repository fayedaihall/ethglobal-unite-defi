// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HTLC.sol";

contract DutchAuction {
    struct Auction {
        address seller;
        address token;
        uint256 startAmount;
        uint256 currentAmount;
        uint256 minAmount;
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
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCounter;
    address public htlcContract;
    address public usdcToken;

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address token, uint256 startAmount, uint256 minAmount, uint256 duration);
    event BidPlaced(uint256 indexed auctionId, address indexed buyer, uint256 amount, bytes32 escrowId);
    event PartialFill(uint256 indexed auctionId, address indexed buyer, uint256 filledAmount, uint256 remainingAmount);
    event AuctionCompleted(uint256 indexed auctionId, address indexed buyer, uint256 totalAmount);

    constructor(address _htlcContract, address _usdcToken) {
        htlcContract = _htlcContract;
        usdcToken = _usdcToken;
    }

    function createAuction(
        address token,
        uint256 startAmount,
        uint256 minAmount,
        uint256 duration,
        uint256 stepTime,
        uint256 stepAmount
    ) external returns (uint256) {
        require(startAmount > minAmount, "Start amount must be greater than min amount");
        require(duration > 0, "Duration must be greater than 0");
        require(stepTime > 0, "Step time must be greater than 0");
        require(stepAmount > 0, "Step amount must be greater than 0");

        uint256 auctionId = auctionCounter++;
        
        auctions[auctionId] = Auction({
            seller: msg.sender,
            token: token,
            startAmount: startAmount,
            currentAmount: startAmount,
            minAmount: minAmount,
            startTime: block.timestamp,
            duration: duration,
            stepTime: stepTime,
            stepAmount: stepAmount,
            active: true,
            sold: false,
            buyer: address(0),
            escrowId: bytes32(0),
            filledAmount: 0,
            remainingAmount: startAmount
        });

        emit AuctionCreated(auctionId, msg.sender, token, startAmount, minAmount, duration);
        return auctionId;
    }

    function getCurrentPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 steps = elapsed / auction.stepTime;
        uint256 priceReduction = steps * auction.stepAmount;
        
        if (priceReduction >= auction.startAmount - auction.minAmount) {
            return auction.minAmount;
        }
        
        return auction.startAmount - priceReduction;
    }

    function placeBid(uint256 auctionId, bytes32 escrowId, uint256 fillAmount) external {
        Auction storage auction = auctions[auctionId];
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
        auction.currentAmount = getCurrentPrice(auctionId);

        // If this is the first bid, set the buyer
        if (auction.buyer == address(0)) {
            auction.buyer = msg.sender;
        }

        // If auction is fully filled, mark as sold
        if (auction.remainingAmount == 0) {
            auction.sold = true;
            auction.active = false;
            emit AuctionCompleted(auctionId, msg.sender, auction.filledAmount);
        } else {
            emit PartialFill(auctionId, msg.sender, fillAmount, auction.remainingAmount);
        }

        emit BidPlaced(auctionId, msg.sender, totalCost, escrowId);
    }

    function placeBid(uint256 auctionId, bytes32 escrowId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(auction.remainingAmount > 0, "Auction fully filled");

        // Default to filling the entire remaining amount
        this.placeBid(auctionId, escrowId, auction.remainingAmount);
    }

    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.active, "Auction not active");
        require(auction.filledAmount == 0, "Cannot cancel auction with fills");

        auction.active = false;
    }

    function withdrawProceeds(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can withdraw");
        require(auction.filledAmount > 0, "No proceeds to withdraw");

        uint256 totalProceeds = calculateTotalProceeds(auctionId);
        require(IERC20(usdcToken).transfer(msg.sender, totalProceeds), "USDC transfer failed");
    }

    function calculateTotalProceeds(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        // This is a simplified calculation - in practice you'd track individual fill prices
        uint256 avgPrice = (auction.startAmount + auction.minAmount) / 2;
        return auction.filledAmount * avgPrice / 1e6;
    }

    // Individual getter functions to avoid stack too deep
    function getAuctionSeller(uint256 auctionId) external view returns (address) {
        return auctions[auctionId].seller;
    }
    function getAuctionToken(uint256 auctionId) external view returns (address) {
        return auctions[auctionId].token;
    }
    function getAuctionStartAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].startAmount;
    }
    function getAuctionCurrentAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].currentAmount;
    }
    function getAuctionMinAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].minAmount;
    }
    function getAuctionStartTime(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].startTime;
    }
    function getAuctionDuration(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].duration;
    }
    function getAuctionStepTime(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].stepTime;
    }
    function getAuctionStepAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].stepAmount;
    }
    function getAuctionActive(uint256 auctionId) external view returns (bool) {
        return auctions[auctionId].active;
    }
    function getAuctionSold(uint256 auctionId) external view returns (bool) {
        return auctions[auctionId].sold;
    }
    function getAuctionBuyer(uint256 auctionId) external view returns (address) {
        return auctions[auctionId].buyer;
    }
    function getAuctionEscrowId(uint256 auctionId) external view returns (bytes32) {
        return auctions[auctionId].escrowId;
    }
    function getAuctionFilledAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].filledAmount;
    }
    function getAuctionRemainingAmount(uint256 auctionId) external view returns (uint256) {
        return auctions[auctionId].remainingAmount;
    }
} 