import { ethers } from "ethers";
import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.sepolia";
dotenv.config({ path: envFile });

interface BetEventData {
  eventId: string;
  description: string;
  endTime: number;
  totalBets: string;
  resolved: boolean;
  outcome: boolean;
}

interface CrossChainBetData {
  betId: string;
  eventId: string;
  amount: string;
  outcome: boolean;
  userAddress: string;
  nearAccountId: string;
  completed: boolean;
}

interface AIPredictionData {
  eventId: string;
  predictedOutcome: boolean;
  confidence: number;
  oracleData: string;
  timestamp: number;
}

class BetSwapAIIntegration {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private betTokenContract: ethers.Contract;
  private betSwapAIContract: ethers.Contract;
  private htlcContract: ethers.Contract;
  private dutchAuctionContract: ethers.Contract;
  private solverContract: ethers.Contract;
  private nearAccount: any;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    let privateKey = process.env.ETH_PRIVATE_KEY!;
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    const betTokenAddress = process.env.BET_TOKEN_ETH_ADDRESS;
    const betSwapAIAddress = process.env.BETSWAP_AI_ETH_ADDRESS;
    const htlcAddress = process.env.HTLC_ETH_ADDRESS;
    const dutchAuctionAddress = process.env.DUTCH_AUCTION_ETH_ADDRESS;
    const solverAddress = process.env.SHADE_AGENT_SOLVER_ETH_ADDRESS;

    if (
      !betTokenAddress ||
      !betSwapAIAddress ||
      !htlcAddress ||
      !dutchAuctionAddress ||
      !solverAddress
    ) {
      throw new Error(
        "BET_TOKEN_ETH_ADDRESS, BETSWAP_AI_ETH_ADDRESS, HTLC_ETH_ADDRESS, DUTCH_AUCTION_ETH_ADDRESS, and SHADE_AGENT_SOLVER_ETH_ADDRESS must be set in .env"
      );
    }

    this.betTokenContract = new ethers.Contract(
      betTokenAddress,
      [
        "function balanceOf(address) view returns(uint256)",
        "function approve(address,uint256) returns(bool)",
        "function transferFrom(address,address,uint256) returns(bool)",
        "function createBetEvent(bytes32,string,uint256)",
        "function placeBet(bytes32,uint256,bool)",
        "function getEventInfo(bytes32) view returns(string,uint256,bool,bool,uint256)",
        "function getUserBet(bytes32,address) view returns(uint256)",
        "function getUserRewards(address) view returns(uint256)",
      ],
      this.wallet
    );

    this.betSwapAIContract = new ethers.Contract(
      betSwapAIAddress,
      [
        "function createBetEvent(bytes32,string,uint256)",
        "function placeBet(bytes32,uint256,bool)",
        "function placeCrossChainBet(bytes32,uint256,bool,string) returns(bytes32)",
        "function resolveBetWithAI(bytes32,bool,uint256)",
        "function claimRewards()",
        "function getBetEventInfo(bytes32) view returns(string,uint256,bool,bool,uint256)",
        "function getUserBet(bytes32,address) view returns(uint256)",
        "function getUserRewards(address) view returns(uint256)",
      ],
      this.wallet
    );

    this.htlcContract = new ethers.Contract(
      htlcAddress,
      [
        "function createLock(bytes32,address,address,uint256,bytes32,uint256) returns(bool)",
        "function withdraw(bytes32,string) returns(bool)",
        "function refund(bytes32) returns(bool)",
      ],
      this.wallet
    );

    this.dutchAuctionContract = new ethers.Contract(
      dutchAuctionAddress,
      [
        "function createAuction(address,uint256,uint256,uint256,uint256,uint256) returns(uint256)",
        "function placeBid(uint256,bytes32)",
        "function getCurrentPrice(uint256) view returns(uint256)",
      ],
      this.wallet
    );

    this.solverContract = new ethers.Contract(
      solverAddress,
      [
        "function registerSolver(address,uint256,uint256,uint256)",
        "function requestQuote(address,address,uint256,uint256) returns(bytes32)",
        "function generateQuote(bytes32,uint256,bytes32,bytes) returns(bytes32)",
        "function executeMetaOrder(bytes32,string)",
      ],
      this.wallet
    );

    this.setupNearAccount();
  }

  private async setupNearAccount() {
    const { keyStores, Near, KeyPair } = nearAPI;
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(
      process.env.RESOLVER_NEAR_PRIVATE_KEY! as any
    );

    await keyStore.setKey(
      process.env.NEAR_NETWORK!,
      process.env.RESOLVER_NEAR_ACCOUNT_ID!,
      keyPair
    );

    const config = {
      networkId: process.env.NEAR_NETWORK!,
      keyStore,
      nodeUrl: process.env.NEAR_RPC!,
      walletUrl: `https://testnet.mynearwallet.com/`,
      helperUrl: `https://helper.testnet.near.org`,
      explorerUrl: `https://testnet.nearblocks.io`,
    };

    const near = new Near(config);
    this.nearAccount = await near.account(
      process.env.RESOLVER_NEAR_ACCOUNT_ID!
    );
  }

  // Create a new betting event
  async createBetEvent(
    eventId: string,
    description: string,
    endTime: number
  ): Promise<void> {
    console.log(`🎯 Creating betting event: ${description}`);

    try {
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const tx = await this.betSwapAIContract.createBetEvent(
        eventIdBytes,
        description,
        endTime
      );
      await tx.wait();

      console.log(`✅ Betting event created successfully!`);
      console.log(`   Event ID: ${eventId}`);
      console.log(`   Description: ${description}`);
      console.log(`   End Time: ${new Date(endTime * 1000).toISOString()}`);
      console.log(`   Transaction: ${tx.hash}`);
    } catch (error: any) {
      console.error("❌ Failed to create betting event:", error.message);
      throw error;
    }
  }

  // Place a bet on an event
  async placeBet(
    eventId: string,
    amount: string,
    outcome: boolean
  ): Promise<void> {
    console.log(`💰 Placing bet on event: ${eventId}`);

    try {
      // Check token balance
      const balance = await this.betTokenContract.balanceOf(
        this.wallet.address
      );
      console.log(`Your BET token balance: ${balance.toString()}`);

      if (BigInt(balance) < BigInt(amount)) {
        throw new Error("Insufficient BET token balance");
      }

      // Approve tokens
      const approveTx = await this.betTokenContract.approve(
        await this.betSwapAIContract.getAddress(),
        amount
      );
      await approveTx.wait();
      console.log(`✅ Token approval confirmed`);

      // Place bet
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const tx = await this.betSwapAIContract.placeBet(
        eventIdBytes,
        amount,
        outcome
      );
      await tx.wait();

      console.log(`✅ Bet placed successfully!`);
      console.log(`   Amount: ${amount} BET tokens`);
      console.log(`   Outcome: ${outcome ? "Yes" : "No"}`);
      console.log(`   Transaction: ${tx.hash}`);
    } catch (error: any) {
      console.error("❌ Failed to place bet:", error.message);
      throw error;
    }
  }

  // Place a cross-chain bet
  async placeCrossChainBet(
    eventId: string,
    amount: string,
    outcome: boolean,
    nearAccountId: string
  ): Promise<string> {
    console.log(`🌉 Placing cross-chain bet: ${eventId} -> ${nearAccountId}`);

    try {
      // Check token balance
      const balance = await this.betTokenContract.balanceOf(
        this.wallet.address
      );
      if (BigInt(balance) < BigInt(amount)) {
        throw new Error("Insufficient BET token balance");
      }

      // Approve tokens
      const approveTx = await this.betTokenContract.approve(
        await this.betSwapAIContract.getAddress(),
        amount
      );
      await approveTx.wait();

      // Place cross-chain bet
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const tx = await this.betSwapAIContract.placeCrossChainBet(
        eventIdBytes,
        amount,
        outcome,
        nearAccountId
      );
      await tx.wait();

      // Get bet ID from event
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      const betId = receipt?.logs?.[0]?.topics?.[1] || "unknown";

      console.log(`✅ Cross-chain bet placed successfully!`);
      console.log(`   Bet ID: ${betId}`);
      console.log(`   Amount: ${amount} BET tokens`);
      console.log(`   NEAR Account: ${nearAccountId}`);
      console.log(`   Transaction: ${tx.hash}`);

      return betId;
    } catch (error: any) {
      console.error("❌ Failed to place cross-chain bet:", error.message);
      throw error;
    }
  }

  // Resolve bet with AI prediction
  async resolveBetWithAI(
    eventId: string,
    oracleData: string
  ): Promise<AIPredictionData> {
    console.log(`🤖 Resolving bet with AI: ${eventId}`);

    try {
      // Simulate AI analysis
      const predictedOutcome = this._analyzeOracleData(oracleData);
      const confidence = this._calculateConfidence(oracleData);

      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const tx = await this.betSwapAIContract.resolveBetWithAI(
        eventIdBytes,
        predictedOutcome,
        confidence
      );
      await tx.wait();

      console.log(`✅ Bet resolved with AI!`);
      console.log(`   Predicted Outcome: ${predictedOutcome ? "Yes" : "No"}`);
      console.log(`   Confidence: ${confidence}%`);
      console.log(`   Oracle Data: ${oracleData}`);
      console.log(`   Transaction: ${tx.hash}`);

      return {
        eventId,
        predictedOutcome,
        confidence,
        oracleData,
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error: any) {
      console.error("❌ Failed to resolve bet with AI:", error.message);
      throw error;
    }
  }

  // Claim rewards
  async claimRewards(): Promise<void> {
    console.log(`🎁 Claiming rewards...`);

    try {
      const tx = await this.betSwapAIContract.claimRewards();
      await tx.wait();

      console.log(`✅ Rewards claimed successfully!`);
      console.log(`   Transaction: ${tx.hash}`);
    } catch (error: any) {
      console.error("❌ Failed to claim rewards:", error.message);
      throw error;
    }
  }

  // Get bet event information
  async getBetEventInfo(eventId: string): Promise<BetEventData> {
    console.log(`📊 Getting bet event info: ${eventId}`);

    try {
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const info = await this.betSwapAIContract.getBetEventInfo(eventIdBytes);

      const eventData: BetEventData = {
        eventId,
        description: info[0],
        endTime: Number(info[1]),
        resolved: info[2],
        outcome: info[3],
        totalBets: info[4].toString(),
      };

      console.log(`📋 Event Information:`);
      console.log(`   Description: ${eventData.description}`);
      console.log(
        `   End Time: ${new Date(eventData.endTime * 1000).toISOString()}`
      );
      console.log(`   Resolved: ${eventData.resolved ? "✅" : "❌"}`);
      console.log(`   Outcome: ${eventData.outcome ? "Yes" : "No"}`);
      console.log(`   Total Bets: ${eventData.totalBets} BET tokens`);

      return eventData;
    } catch (error: any) {
      console.error("❌ Failed to get bet event info:", error.message);
      throw error;
    }
  }

  // Get user bet information
  async getUserBet(eventId: string, userAddress: string): Promise<string> {
    try {
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
      const betAmount = await this.betSwapAIContract.getUserBet(
        eventIdBytes,
        userAddress
      );
      return betAmount.toString();
    } catch (error: any) {
      console.error("❌ Failed to get user bet:", error.message);
      throw error;
    }
  }

  // Get user rewards
  async getUserRewards(userAddress: string): Promise<string> {
    try {
      const rewards = await this.betSwapAIContract.getUserRewards(userAddress);
      return rewards.toString();
    } catch (error: any) {
      console.error("❌ Failed to get user rewards:", error.message);
      throw error;
    }
  }

  // Demonstrate complete BetSwap AI workflow
  async demonstrateBetSwapAIWorkflow(): Promise<void> {
    console.log("🎯 Demonstrating BetSwap AI Complete Workflow...\n");

    // Step 1: Create betting event
    const eventId = "world_cup_final_2024";
    const description = "Will Team A win the World Cup Final 2024?";
    const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    await this.createBetEvent(eventId, description, endTime);

    // Step 2: Place bets
    const betAmount = "1000000"; // 1M BET tokens
    await this.placeBet(eventId, betAmount, true); // Bet on "Yes"
    await this.placeBet(eventId, "500000", false); // Bet on "No"

    // Step 3: Place cross-chain bet
    const crossChainBetId = await this.placeCrossChainBet(
      eventId,
      "2000000",
      true,
      "fayefaye2.testnet"
    );

    // Step 4: Resolve with AI
    const oracleData =
      "Team A has 65% win probability based on recent performance";
    const aiPrediction = await this.resolveBetWithAI(eventId, oracleData);

    // Step 5: Claim rewards
    await this.claimRewards();

    // Step 6: Get final information
    const eventInfo = await this.getBetEventInfo(eventId);
    const userBet = await this.getUserBet(eventId, this.wallet.address);
    const userRewards = await this.getUserRewards(this.wallet.address);

    console.log("\n📊 Final Summary:");
    console.log(`   Event: ${eventInfo.description}`);
    console.log(
      `   AI Prediction: ${aiPrediction.predictedOutcome ? "Yes" : "No"} (${
        aiPrediction.confidence
      }% confidence)`
    );
    console.log(`   Your Bet: ${userBet} BET tokens`);
    console.log(`   Your Rewards: ${userRewards} BET tokens`);
    console.log(`   Cross-Chain Bet ID: ${crossChainBetId}`);

    console.log("\n✅ BetSwap AI Workflow Completed Successfully!");
  }

  // Internal helper functions
  private _analyzeOracleData(oracleData: string): boolean {
    // Simulate AI analysis - in production, this would use actual ML models
    const hash = crypto.createHash("sha256").update(oracleData).digest();
    return hash[0] % 2 === 0;
  }

  private _calculateConfidence(oracleData: string): number {
    // Simulate confidence calculation
    const hash = crypto.createHash("sha256").update(oracleData).digest();
    return ((hash[1] as number) * 100) / 255;
  }
}

// Command line interface
async function main() {
  const integration = new BetSwapAIIntegration();
  const command = process.argv[2];

  try {
    switch (command) {
      case "create-event":
        const eventId = process.argv[3];
        const description = process.argv[4];
        const endTime = parseInt(process.argv[5]);

        if (!eventId || !description || !endTime) {
          console.error(
            "Usage: ts-node scripts/betswap-ai-integration.ts create-event <eventId> <description> <endTime>"
          );
          console.error(
            "Example: ts-node scripts/betswap-ai-integration.ts create-event world_cup_final 'Will Team A win?' 1704067200"
          );
          process.exit(1);
        }

        await integration.createBetEvent(eventId, description, endTime);
        break;

      case "place-bet":
        const betEventId = process.argv[3];
        const amount = process.argv[4];
        const outcome = process.argv[5] === "true";

        if (!betEventId || !amount || process.argv[5] === undefined) {
          console.error(
            "Usage: ts-node scripts/betswap-ai-integration.ts place-bet <eventId> <amount> <outcome>"
          );
          console.error(
            "Example: ts-node scripts/betswap-ai-integration.ts place-bet world_cup_final 1000000 true"
          );
          process.exit(1);
        }

        await integration.placeBet(betEventId, amount, outcome);
        break;

      case "cross-chain-bet":
        const crossEventId = process.argv[3];
        const crossAmount = process.argv[4];
        const crossOutcome = process.argv[5] === "true";
        const nearAccountId = process.argv[6];

        if (
          !crossEventId ||
          !crossAmount ||
          process.argv[5] === undefined ||
          !nearAccountId
        ) {
          console.error(
            "Usage: ts-node scripts/betswap-ai-integration.ts cross-chain-bet <eventId> <amount> <outcome> <nearAccountId>"
          );
          console.error(
            "Example: ts-node scripts/betswap-ai-integration.ts cross-chain-bet world_cup_final 2000000 true fayefaye2.testnet"
          );
          process.exit(1);
        }

        await integration.placeCrossChainBet(
          crossEventId,
          crossAmount,
          crossOutcome,
          nearAccountId
        );
        break;

      case "resolve-ai":
        const resolveEventId = process.argv[3];
        const oracleData = process.argv[4];

        if (!resolveEventId || !oracleData) {
          console.error(
            "Usage: ts-node scripts/betswap-ai-integration.ts resolve-ai <eventId> <oracleData>"
          );
          console.error(
            "Example: ts-node scripts/betswap-ai-integration.ts resolve-ai world_cup_final 'Team A has 65% win probability'"
          );
          process.exit(1);
        }

        await integration.resolveBetWithAI(resolveEventId, oracleData);
        break;

      case "claim-rewards":
        await integration.claimRewards();
        break;

      case "event-info":
        const infoEventId = process.argv[3];

        if (!infoEventId) {
          console.error(
            "Usage: ts-node scripts/betswap-ai-integration.ts event-info <eventId>"
          );
          console.error(
            "Example: ts-node scripts/betswap-ai-integration.ts event-info world_cup_final"
          );
          process.exit(1);
        }

        await integration.getBetEventInfo(infoEventId);
        break;

      case "demo":
        await integration.demonstrateBetSwapAIWorkflow();
        break;

      default:
        console.log("Available commands:");
        console.log("  create-event <eventId> <description> <endTime>");
        console.log("  place-bet <eventId> <amount> <outcome>");
        console.log(
          "  cross-chain-bet <eventId> <amount> <outcome> <nearAccountId>"
        );
        console.log("  resolve-ai <eventId> <oracleData>");
        console.log("  claim-rewards");
        console.log("  event-info <eventId>");
        console.log("  demo");
        break;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
