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
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCounter;
    
    HTLC public htlcContract;
    IERC20 public usdcToken;
    
    event AuctionCreated(uint256 auctionId, address seller, uint256 startAmount, uint256 duration);
    event BidPlaced(uint256 auctionId, address bidder, uint256 amount);
    event AuctionSold(uint256 auctionId, address buyer, uint256 amount);
    event AuctionCancelled(uint256 auctionId);
    event PriceUpdated(uint256 auctionId, uint256 newPrice);

    constructor(address _htlcContract, address _usdcToken) {
        htlcContract = HTLC(_htlcContract);
        usdcToken = IERC20(_usdcToken);
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
        require(duration > 0, "Duration must be positive");
        require(stepTime > 0, "Step time must be positive");
        require(stepAmount > 0, "Step amount must be positive");
        
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
            escrowId: bytes32(0)
        });
        
        emit AuctionCreated(auctionId, msg.sender, startAmount, duration);
        return auctionId;
    }

    function getCurrentPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        
        if (block.timestamp >= auction.startTime + auction.duration) {
            return auction.minAmount;
        }
        
        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 steps = elapsed / auction.stepTime;
        uint256 priceReduction = steps * auction.stepAmount;
        
        if (priceReduction >= auction.startAmount - auction.minAmount) {
            return auction.minAmount;
        }
        
        return auction.startAmount - priceReduction;
    }

    function updatePrice(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(!auction.sold, "Auction already sold");
        
        uint256 newPrice = getCurrentPrice(auctionId);
        auction.currentAmount = newPrice;
        
        emit PriceUpdated(auctionId, newPrice);
    }

    function placeBid(uint256 auctionId, bytes32 escrowId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(!auction.sold, "Auction already sold");
        require(block.timestamp < auction.startTime + auction.duration, "Auction expired");
        
        uint256 currentPrice = getCurrentPrice(auctionId);
        require(usdcToken.balanceOf(msg.sender) >= currentPrice, "Insufficient USDC balance");
        
        // Transfer USDC to this contract
        require(usdcToken.transferFrom(msg.sender, address(this), currentPrice), "USDC transfer failed");
        
        auction.sold = true;
        auction.buyer = msg.sender;
        auction.escrowId = escrowId;
        auction.currentAmount = currentPrice;
        
        emit AuctionSold(auctionId, msg.sender, currentPrice);
    }

    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.active, "Auction not active");
        require(!auction.sold, "Auction already sold");
        
        auction.active = false;
        emit AuctionCancelled(auctionId);
    }

    function withdrawProceeds(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can withdraw");
        require(auction.sold, "Auction not sold");
        
        uint256 amount = auction.currentAmount;
        auction.currentAmount = 0;
        
        require(usdcToken.transfer(auction.seller, amount), "USDC transfer failed");
    }

    // Remove getAuctionDetails and getAuctionStatus
    // Add individual getters for each Auction field
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
} 