import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

interface AuctionDetails {
  seller: string;
  token: string;
  startAmount: string;
  currentAmount: string;
  minAmount: string;
  startTime: number;
  duration: number;
  stepTime: number;
  stepAmount: string;
  active: boolean;
  sold: boolean;
  buyer: string;
  escrowId: string;
}

interface AuctionStatus {
  active: boolean;
  sold: boolean;
  currentPrice: string;
  timeRemaining: number;
}

class DutchAuctionManager {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private usdcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // Ensure private key has 0x prefix
    let privateKey = process.env.ETH_PRIVATE_KEY!;
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    const dutchAuctionAddress = process.env.DUTCH_AUCTION_ETH_ADDRESS;
    const usdcAddress = process.env.USDC_ETH_ADDRESS;

    if (!dutchAuctionAddress || !usdcAddress) {
      throw new Error(
        "DUTCH_AUCTION_ETH_ADDRESS and USDC_ETH_ADDRESS must be set in .env"
      );
    }

    this.contract = new ethers.Contract(
      dutchAuctionAddress,
      [
        "function createAuction(address token, uint256 startAmount, uint256 minAmount, uint256 duration, uint256 stepTime, uint256 stepAmount) external returns (uint256)",
        "function getCurrentPrice(uint256 auctionId) public view returns (uint256)",
        "function updatePrice(uint256 auctionId) external",
        "function placeBid(uint256 auctionId, bytes32 escrowId) external",
        "function cancelAuction(uint256 auctionId) external",
        "function withdrawProceeds(uint256 auctionId) external",
        "function getAuctionSeller(uint256 auctionId) external view returns (address)",
        "function getAuctionToken(uint256 auctionId) external view returns (address)",
        "function getAuctionStartAmount(uint256 auctionId) external view returns (uint256)",
        "function getAuctionCurrentAmount(uint256 auctionId) external view returns (uint256)",
        "function getAuctionMinAmount(uint256 auctionId) external view returns (uint256)",
        "function getAuctionStartTime(uint256 auctionId) external view returns (uint256)",
        "function getAuctionDuration(uint256 auctionId) external view returns (uint256)",
        "function getAuctionStepTime(uint256 auctionId) external view returns (uint256)",
        "function getAuctionStepAmount(uint256 auctionId) external view returns (uint256)",
        "function getAuctionActive(uint256 auctionId) external view returns (bool)",
        "function getAuctionSold(uint256 auctionId) external view returns (bool)",
        "function getAuctionBuyer(uint256 auctionId) external view returns (address)",
        "function getAuctionEscrowId(uint256 auctionId) external view returns (bytes32)",
        "function auctionCounter() external view returns (uint256)",
        "function htlcContract() external view returns (address)",
        "function usdcToken() external view returns (address)",
      ],
      this.wallet
    );

    this.usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function approve(address,uint256) returns(bool)",
        "function balanceOf(address) view returns(uint256)",
        "function transferFrom(address,address,uint256) returns(bool)",
      ],
      this.wallet
    );
  }

  async createAuction(
    tokenAddress: string,
    startAmount: string,
    minAmount: string,
    duration: number,
    stepTime: number,
    stepAmount: string
  ): Promise<number> {
    console.log("🏗️ Creating new Dutch auction...");
    console.log(`Token: ${tokenAddress}`);
    console.log(
      `Start Amount: ${startAmount} (${parseInt(startAmount) / 1000000} USDC)`
    );
    console.log(
      `Min Amount: ${minAmount} (${parseInt(minAmount) / 1000000} USDC)`
    );
    console.log(`Duration: ${duration} seconds (${duration / 3600} hours)`);
    console.log(`Step Time: ${stepTime} seconds`);
    console.log(
      `Step Amount: ${stepAmount} (${parseInt(stepAmount) / 1000000} USDC)`
    );

    try {
      const tx = await this.contract.createAuction(
        tokenAddress,
        BigInt(startAmount),
        BigInt(minAmount),
        BigInt(duration),
        BigInt(stepTime),
        BigInt(stepAmount)
      );

      console.log("⏳ Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      const auctionId = (await this.contract.auctionCounter()) - BigInt(1);
      console.log(`✅ Auction created successfully!`);
      console.log(`Auction ID: ${auctionId}`);
      console.log(`Transaction Hash: ${receipt.hash}`);

      return Number(auctionId);
    } catch (error: any) {
      console.error("❌ Failed to create auction:", error.message);
      throw error;
    }
  }

  async getAuctionDetails(auctionId: number): Promise<AuctionDetails> {
    try {
      const seller = await this.contract.getAuctionSeller(auctionId);
      const token = await this.contract.getAuctionToken(auctionId);
      const startAmount = await this.contract.getAuctionStartAmount(auctionId);
      const currentAmount = await this.contract.getAuctionCurrentAmount(
        auctionId
      );
      const minAmount = await this.contract.getAuctionMinAmount(auctionId);
      const startTime = await this.contract.getAuctionStartTime(auctionId);
      const duration = await this.contract.getAuctionDuration(auctionId);
      const stepTime = await this.contract.getAuctionStepTime(auctionId);
      const stepAmount = await this.contract.getAuctionStepAmount(auctionId);
      const active = await this.contract.getAuctionActive(auctionId);
      const sold = await this.contract.getAuctionSold(auctionId);
      const buyer = await this.contract.getAuctionBuyer(auctionId);
      const escrowId = await this.contract.getAuctionEscrowId(auctionId);

      return {
        seller: seller,
        token: token,
        startAmount: startAmount.toString(),
        currentAmount: currentAmount.toString(),
        minAmount: minAmount.toString(),
        startTime: Number(startTime),
        duration: Number(duration),
        stepTime: Number(stepTime),
        stepAmount: stepAmount.toString(),
        active: active,
        sold: sold,
        buyer: buyer,
        escrowId: escrowId,
      };
    } catch (error: any) {
      console.error("❌ Failed to get auction details:", error.message);
      throw error;
    }
  }

  async getAuctionStatus(auctionId: number): Promise<AuctionStatus> {
    try {
      const price = await this.contract.getCurrentPrice(auctionId);
      const duration = await this.contract.getAuctionDuration(auctionId);
      const startTime = await this.contract.getAuctionStartTime(auctionId);
      const timeRemaining =
        Number(duration) - (Date.now() / 1000 - Number(startTime));

      return {
        active: true, // Dutch auctions are always active until sold
        sold: await this.contract.getAuctionSold(auctionId),
        currentPrice: price.toString(),
        timeRemaining: Math.max(0, timeRemaining),
      };
    } catch (error: any) {
      console.error("❌ Failed to get auction status:", error.message);
      throw error;
    }
  }

  async getCurrentPrice(auctionId: number): Promise<string> {
    try {
      const price = await this.contract.getCurrentPrice(auctionId);
      return price.toString();
    } catch (error: any) {
      console.error("❌ Failed to get current price:", error.message);
      throw error;
    }
  }

  async placeBid(auctionId: number, escrowId: string): Promise<void> {
    console.log(`💰 Placing bid on auction ${auctionId}...`);

    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice(auctionId);
      console.log(
        `Current price: ${currentPrice} (${
          parseInt(currentPrice) / 1000000
        } USDC)`
      );

      // Check USDC balance
      const balance = await this.usdcContract.balanceOf(this.wallet.address);
      console.log(
        `Your USDC balance: ${balance.toString()} (${
          parseInt(balance.toString()) / 1000000
        } USDC)`
      );

      if (BigInt(balance) < BigInt(currentPrice)) {
        throw new Error("Insufficient USDC balance");
      }

      // Approve USDC spending
      console.log("🔐 Approving USDC spending...");
      const approveTx = await this.usdcContract.approve(
        await this.contract.getAddress(),
        currentPrice
      );
      await approveTx.wait();
      console.log("✅ USDC approval confirmed");

      // Place bid
      console.log("🏷️ Placing bid...");
      const tx = await this.contract.placeBid(auctionId, escrowId);
      await tx.wait();

      console.log("✅ Bid placed successfully!");
      console.log(`Transaction Hash: ${tx.hash}`);
      console.log(`Escrow ID: ${escrowId}`);
    } catch (error: any) {
      console.error("❌ Failed to place bid:", error.message);
      throw error;
    }
  }

  async updatePrice(auctionId: number): Promise<void> {
    console.log(`📊 Updating price for auction ${auctionId}...`);

    try {
      const tx = await this.contract.updatePrice(auctionId);
      await tx.wait();

      const newPrice = await this.getCurrentPrice(auctionId);
      console.log(`✅ Price updated successfully!`);
      console.log(
        `New price: ${newPrice} (${parseInt(newPrice) / 1000000} USDC)`
      );
    } catch (error: any) {
      console.error("❌ Failed to update price:", error.message);
      throw error;
    }
  }

  async cancelAuction(auctionId: number): Promise<void> {
    console.log(`❌ Cancelling auction ${auctionId}...`);

    try {
      const tx = await this.contract.cancelAuction(auctionId);
      await tx.wait();

      console.log("✅ Auction cancelled successfully!");
      console.log(`Transaction Hash: ${tx.hash}`);
    } catch (error: any) {
      console.error("❌ Failed to cancel auction:", error.message);
      throw error;
    }
  }

  async withdrawProceeds(auctionId: number): Promise<void> {
    console.log(`💸 Withdrawing proceeds from auction ${auctionId}...`);

    try {
      const tx = await this.contract.withdrawProceeds(auctionId);
      await tx.wait();

      console.log("✅ Proceeds withdrawn successfully!");
      console.log(`Transaction Hash: ${tx.hash}`);
    } catch (error: any) {
      console.error("❌ Failed to withdraw proceeds:", error.message);
      throw error;
    }
  }

  async listAllAuctions(): Promise<void> {
    try {
      const counter = await this.contract.auctionCounter();
      console.log(`📋 Total auctions created: ${counter.toString()}`);

      if (counter === BigInt(0)) {
        console.log("No auctions found.");
        return;
      }

      console.log("\n🏷️ Auction List:");
      console.log("=".repeat(80));

      for (let i = 0; i < Number(counter); i++) {
        try {
          const details = await this.getAuctionDetails(i);
          const status = await this.getAuctionStatus(i);

          console.log(`\n🎯 Auction #${i}:`);
          console.log(`   Seller: ${details.seller}`);
          console.log(
            `   Status: ${status.active ? "Active" : "Inactive"} | ${
              status.sold ? "Sold" : "Available"
            }`
          );
          console.log(
            `   Price: ${status.currentPrice} (${
              parseInt(status.currentPrice) / 1000000
            } USDC)`
          );
          console.log(
            `   Time Remaining: ${status.timeRemaining} seconds (${Math.floor(
              status.timeRemaining / 3600
            )} hours)`
          );
          console.log(
            `   Duration: ${details.duration} seconds (${
              details.duration / 3600
            } hours)`
          );

          if (status.sold) {
            console.log(`   Buyer: ${details.buyer}`);
            console.log(`   Escrow ID: ${details.escrowId}`);
          }
        } catch (error) {
          console.log(`❌ Failed to get details for auction #${i}`);
        }
      }
    } catch (error: any) {
      console.error("❌ Failed to list auctions:", error.message);
    }
  }
}

// Command line interface
async function main() {
  const manager = new DutchAuctionManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case "create":
        const tokenAddress = process.argv[3];
        const startAmount = process.argv[4];
        const minAmount = process.argv[5];
        const duration = parseInt(process.argv[6]);
        const stepTime = parseInt(process.argv[7]);
        const stepAmount = process.argv[8];

        if (
          !tokenAddress ||
          !startAmount ||
          !minAmount ||
          !duration ||
          !stepTime ||
          !stepAmount
        ) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts create <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount>"
          );
          console.error(
            "Example: ts-node scripts/dutch-auction.ts create 0x123... 1000000 500000 3600 300 50000"
          );
          process.exit(1);
        }

        await manager.createAuction(
          tokenAddress,
          startAmount,
          minAmount,
          duration,
          stepTime,
          stepAmount
        );
        break;

      case "bid":
        const auctionId = parseInt(process.argv[3]);
        const escrowId = process.argv[4];

        if (!auctionId || !escrowId) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts bid <auctionId> <escrowId>"
          );
          console.error(
            "Example: ts-node scripts/dutch-auction.ts bid 0 0x123..."
          );
          process.exit(1);
        }

        await manager.placeBid(auctionId, escrowId);
        break;

      case "status":
        const statusAuctionId = parseInt(process.argv[3]);

        if (!statusAuctionId) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts status <auctionId>"
          );
          console.error("Example: ts-node scripts/dutch-auction.ts status 0");
          process.exit(1);
        }

        const status = await manager.getAuctionStatus(statusAuctionId);
        const details = await manager.getAuctionDetails(statusAuctionId);

        console.log(`\n📊 Auction #${statusAuctionId} Status:`);
        console.log(`Active: ${status.active ? "✅" : "❌"}`);
        console.log(`Sold: ${status.sold ? "✅" : "❌"}`);
        console.log(
          `Current Price: ${status.currentPrice} (${
            parseInt(status.currentPrice) / 1000000
          } USDC)`
        );
        console.log(
          `Time Remaining: ${status.timeRemaining} seconds (${Math.floor(
            status.timeRemaining / 3600
          )} hours)`
        );
        console.log(`Seller: ${details.seller}`);
        console.log(
          `Start Amount: ${details.startAmount} (${
            parseInt(details.startAmount) / 1000000
          } USDC)`
        );
        console.log(
          `Min Amount: ${details.minAmount} (${
            parseInt(details.minAmount) / 1000000
          } USDC)`
        );

        if (status.sold) {
          console.log(`Buyer: ${details.buyer}`);
          console.log(`Escrow ID: ${details.escrowId}`);
        }
        break;

      case "list":
        await manager.listAllAuctions();
        break;

      case "update-price":
        const updateAuctionId = parseInt(process.argv[3]);

        if (!updateAuctionId) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts update-price <auctionId>"
          );
          console.error(
            "Example: ts-node scripts/dutch-auction.ts update-price 0"
          );
          process.exit(1);
        }

        await manager.updatePrice(updateAuctionId);
        break;

      case "cancel":
        const cancelAuctionId = parseInt(process.argv[3]);

        if (!cancelAuctionId) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts cancel <auctionId>"
          );
          console.error("Example: ts-node scripts/dutch-auction.ts cancel 0");
          process.exit(1);
        }

        await manager.cancelAuction(cancelAuctionId);
        break;

      case "withdraw":
        const withdrawAuctionId = parseInt(process.argv[3]);

        if (!withdrawAuctionId) {
          console.error(
            "Usage: ts-node scripts/dutch-auction.ts withdraw <auctionId>"
          );
          console.error("Example: ts-node scripts/dutch-auction.ts withdraw 0");
          process.exit(1);
        }

        await manager.withdrawProceeds(withdrawAuctionId);
        break;

      default:
        console.log("Available commands:");
        console.log(
          "  create <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount>"
        );
        console.log("  bid <auctionId> <escrowId>");
        console.log("  status <auctionId>");
        console.log("  list");
        console.log("  update-price <auctionId>");
        console.log("  cancel <auctionId>");
        console.log("  withdraw <auctionId>");
        break;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
