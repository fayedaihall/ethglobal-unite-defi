import { ethers } from "ethers";
import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.sepolia";
dotenv.config({ path: envFile });

interface SolverQuote {
  requestId: string;
  orderId: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fee: string;
  solver: string;
  intentId: string;
  signature: string;
}

interface TEEConfig {
  teeEnclaveId: string;
  attestationReport: string;
  publicKey: string;
  isVerified: boolean;
}

class ShadeAgentSolverIntegration {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private shadeAgentSolverContract: ethers.Contract;
  private htlcContract: ethers.Contract;
  private usdcContract: ethers.Contract;
  private nearAccount: any;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // Ensure private key has 0x prefix
    let privateKey = process.env.ETH_PRIVATE_KEY!;
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    const shadeAgentSolverAddress = process.env.SHADE_AGENT_SOLVER_ETH_ADDRESS;
    const htlcAddress = process.env.HTLC_ETH_ADDRESS;
    const usdcAddress = process.env.USDC_ETH_ADDRESS;

    if (!shadeAgentSolverAddress || !htlcAddress || !usdcAddress) {
      throw new Error(
        "SHADE_AGENT_SOLVER_ETH_ADDRESS, HTLC_ETH_ADDRESS, and USDC_ETH_ADDRESS must be set in .env"
      );
    }

    this.shadeAgentSolverContract = new ethers.Contract(
      shadeAgentSolverAddress,
      [
        "function registerSolver(address solverAddress, uint256 minQuoteAmount, uint256 maxQuoteAmount, uint256 feePercentage) external",
        "function requestQuote(address fromToken, address toToken, uint256 fromAmount, uint256 deadline) external returns (bytes32)",
        "function generateQuote(bytes32 requestId, uint256 toAmount, bytes32 intentId, bytes calldata signature) external returns (bytes32)",
        "function executeMetaOrder(bytes32 orderId, string calldata secret) external",
        "function getQuoteRequest(bytes32 requestId) external view returns (tuple)",
        "function getMetaOrder(bytes32 orderId) external view returns (tuple)",
        "function getSolverConfig(address solverAddress) external view returns (tuple)",
        "function getActiveSolvers() external view returns (address[])",
        "function getSolverReputation(address solverAddress) external view returns (uint256)",
        "event QuoteRequested(bytes32 indexed requestId, address indexed fromToken, address indexed toToken, uint256 fromAmount, uint256 toAmount, uint256 deadline)",
        "event QuoteGenerated(bytes32 indexed requestId, bytes32 indexed orderId, address indexed solver, uint256 fromAmount, uint256 toAmount, uint256 fee)",
        "event MetaOrderExecuted(bytes32 indexed orderId, address indexed solver, bytes32 indexed intentId, bool success)",
        "event SolverRegistered(address indexed solver, uint256 minQuoteAmount, uint256 maxQuoteAmount, uint256 feePercentage)",
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

    this.usdcContract = new ethers.Contract(
      usdcAddress,
      [
        "function approve(address,uint256) returns(bool)",
        "function balanceOf(address) view returns(uint256)",
        "function transferFrom(address,address,uint256) returns(bool)",
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

  /**
   * Register a new solver with TEE configuration
   */
  async registerSolver(
    solverAddress: string,
    minQuoteAmount: string,
    maxQuoteAmount: string,
    feePercentage: number,
    teeConfig: TEEConfig
  ): Promise<void> {
    console.log("🔧 Registering solver with TEE configuration...");

    try {
      const tx = await this.shadeAgentSolverContract.registerSolver(
        solverAddress,
        minQuoteAmount,
        maxQuoteAmount,
        feePercentage
      );

      await tx.wait();
      console.log(`✅ Solver registered successfully!`);
      console.log(`Solver Address: ${solverAddress}`);
      console.log(`Fee Percentage: ${feePercentage} basis points`);
      console.log(`TEE Enclave ID: ${teeConfig.teeEnclaveId}`);
    } catch (error: any) {
      console.error("❌ Failed to register solver:", error.message);
      throw error;
    }
  }

  /**
   * Request a quote for cross-chain swap
   */
  async requestQuote(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    deadline: number
  ): Promise<string> {
    console.log("📝 Requesting quote for cross-chain swap...");

    try {
      const tx = await this.shadeAgentSolverContract.requestQuote(
        fromToken,
        toToken,
        fromAmount,
        deadline
      );

      await tx.wait();

      // Get the request ID from the event
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      const requestId = receipt?.logs[0]?.topics[1]; // Extract from event

      console.log(`✅ Quote requested successfully!`);
      console.log(`Request ID: ${requestId}`);
      console.log(`From Token: ${fromToken}`);
      console.log(`To Token: ${toToken}`);
      console.log(`Amount: ${fromAmount}`);
      console.log(`Deadline: ${new Date(deadline * 1000).toISOString()}`);

      return requestId || "unknown";
    } catch (error: any) {
      console.error("❌ Failed to request quote:", error.message);
      throw error;
    }
  }

  /**
   * Generate quote and create meta-order (simulated solver)
   */
  async generateQuote(
    requestId: string,
    toAmount: string,
    intentId: string,
    signature: string
  ): Promise<string> {
    console.log("💰 Generating quote and creating meta-order...");

    try {
      // Simulate NEAR Chain Signature
      const nearSignature = ethers.hexlify(ethers.toUtf8Bytes(signature));

      const tx = await this.shadeAgentSolverContract.generateQuote(
        requestId,
        toAmount,
        intentId,
        nearSignature
      );

      await tx.wait();

      // Get the order ID from the event
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      const orderId = receipt?.logs[0]?.topics[2]; // Extract from event

      console.log(`✅ Quote generated successfully!`);
      console.log(`Order ID: ${orderId}`);
      console.log(`To Amount: ${toAmount}`);
      console.log(`Intent ID: ${intentId}`);

      return orderId || "unknown";
    } catch (error: any) {
      console.error("❌ Failed to generate quote:", error.message);
      throw error;
    }
  }

  /**
   * Execute meta-order using NEAR Chain Signatures
   */
  async executeMetaOrder(orderId: string, secret: string): Promise<boolean> {
    console.log("🚀 Executing meta-order with NEAR Chain Signatures...");

    try {
      const tx = await this.shadeAgentSolverContract.executeMetaOrder(
        orderId,
        secret
      );
      await tx.wait();

      console.log(`✅ Meta-order executed successfully!`);
      console.log(`Order ID: ${orderId}`);
      console.log(`Transaction Hash: ${tx.hash}`);

      return true;
    } catch (error: any) {
      console.error("❌ Failed to execute meta-order:", error.message);
      throw error;
    }
  }

  /**
   * Get quote request details
   */
  async getQuoteRequest(requestId: string): Promise<any> {
    try {
      const quoteRequest = await this.shadeAgentSolverContract.getQuoteRequest(
        requestId
      );
      return quoteRequest;
    } catch (error: any) {
      console.error("❌ Failed to get quote request:", error.message);
      throw error;
    }
  }

  /**
   * Get meta-order details
   */
  async getMetaOrder(orderId: string): Promise<any> {
    try {
      const metaOrder = await this.shadeAgentSolverContract.getMetaOrder(
        orderId
      );
      return metaOrder;
    } catch (error: any) {
      console.error("❌ Failed to get meta-order:", error.message);
      throw error;
    }
  }

  /**
   * Get solver configuration
   */
  async getSolverConfig(solverAddress: string): Promise<any> {
    try {
      const config = await this.shadeAgentSolverContract.getSolverConfig(
        solverAddress
      );
      return config;
    } catch (error: any) {
      console.error("❌ Failed to get solver config:", error.message);
      throw error;
    }
  }

  /**
   * Get solver reputation
   */
  async getSolverReputation(solverAddress: string): Promise<number> {
    try {
      const reputation =
        await this.shadeAgentSolverContract.getSolverReputation(solverAddress);
      return Number(reputation);
    } catch (error: any) {
      console.error("❌ Failed to get solver reputation:", error.message);
      throw error;
    }
  }

  /**
   * Demonstrate end-to-end solver workflow
   */
  async demonstrateSolverWorkflow(): Promise<void> {
    console.log("🎯 Demonstrating Shade Agent Solver Workflow...\n");

    // Step 1: Register a solver
    console.log("Step 1: Registering Solver");
    const solverAddress = this.wallet.address;
    const teeConfig: TEEConfig = {
      teeEnclaveId: "enclave_123456789",
      attestationReport: "attestation_report_abc123",
      publicKey: "0x1234567890abcdef",
      isVerified: true,
    };

    await this.registerSolver(
      solverAddress,
      "1000000", // 1 USDC minimum
      "1000000000", // 1000 USDC maximum
      50, // 0.5% fee
      teeConfig
    );

    // Step 2: Request a quote
    console.log("\nStep 2: Requesting Quote");
    const fromToken = process.env.USDC_ETH_ADDRESS!;
    const toToken = "0x0000000000000000000000000000000000000000"; // ETH
    const fromAmount = "1000000"; // 1 USDC
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const requestId = await this.requestQuote(
      fromToken,
      toToken,
      fromAmount,
      deadline
    );

    // Step 3: Generate quote (simulated solver)
    console.log("\nStep 3: Generating Quote");
    const toAmount = "950000"; // 0.95 USDC (with slippage)
    const intentId = crypto.randomBytes(32).toString("hex");
    const signature = crypto.randomBytes(64).toString("hex");

    const orderId = await this.generateQuote(
      requestId,
      toAmount,
      intentId,
      signature
    );

    // Step 4: Execute meta-order
    console.log("\nStep 4: Executing Meta-Order");
    const secret = crypto.randomBytes(32).toString("hex");
    await this.executeMetaOrder(orderId, secret);

    // Step 5: Verify results
    console.log("\nStep 5: Verifying Results");
    const quoteRequest = await this.getQuoteRequest(requestId);
    const metaOrder = await this.getMetaOrder(orderId);
    const solverConfig = await this.getSolverConfig(solverAddress);
    const reputation = await this.getSolverReputation(solverAddress);

    console.log("\n📊 Workflow Results:");
    console.log(`Quote Request: ${JSON.stringify(quoteRequest, null, 2)}`);
    console.log(`Meta Order: ${JSON.stringify(metaOrder, null, 2)}`);
    console.log(`Solver Config: ${JSON.stringify(solverConfig, null, 2)}`);
    console.log(`Solver Reputation: ${reputation}`);

    console.log("\n✅ Shade Agent Solver Workflow Completed Successfully!");
  }
}

// Command line interface
async function main() {
  const integration = new ShadeAgentSolverIntegration();
  const command = process.argv[2];

  try {
    switch (command) {
      case "register-solver":
        const solverAddress = process.argv[3];
        const minQuoteAmount = process.argv[4];
        const maxQuoteAmount = process.argv[5];
        const feePercentage = parseInt(process.argv[6]);

        if (
          !solverAddress ||
          !minQuoteAmount ||
          !maxQuoteAmount ||
          !feePercentage
        ) {
          console.error(
            "Usage: ts-node scripts/shade-agent-solver-integration.ts register-solver <solverAddress> <minQuoteAmount> <maxQuoteAmount> <feePercentage>"
          );
          process.exit(1);
        }

        const teeConfig: TEEConfig = {
          teeEnclaveId: "enclave_123456789",
          attestationReport: "attestation_report_abc123",
          publicKey: "0x1234567890abcdef",
          isVerified: true,
        };

        await integration.registerSolver(
          solverAddress,
          minQuoteAmount,
          maxQuoteAmount,
          feePercentage,
          teeConfig
        );
        break;

      case "request-quote":
        const fromToken = process.argv[3];
        const toToken = process.argv[4];
        const fromAmount = process.argv[5];
        const deadline = parseInt(process.argv[6]);

        if (!fromToken || !toToken || !fromAmount || !deadline) {
          console.error(
            "Usage: ts-node scripts/shade-agent-solver-integration.ts request-quote <fromToken> <toToken> <fromAmount> <deadline>"
          );
          process.exit(1);
        }

        await integration.requestQuote(
          fromToken,
          toToken,
          fromAmount,
          deadline
        );
        break;

      case "generate-quote":
        const requestId = process.argv[3];
        const toAmount = process.argv[4];
        const intentId = process.argv[5];
        const signature = process.argv[6];

        if (!requestId || !toAmount || !intentId || !signature) {
          console.error(
            "Usage: ts-node scripts/shade-agent-solver-integration.ts generate-quote <requestId> <toAmount> <intentId> <signature>"
          );
          process.exit(1);
        }

        await integration.generateQuote(
          requestId,
          toAmount,
          intentId,
          signature
        );
        break;

      case "execute-order":
        const orderId = process.argv[3];
        const secret = process.argv[4];

        if (!orderId || !secret) {
          console.error(
            "Usage: ts-node scripts/shade-agent-solver-integration.ts execute-order <orderId> <secret>"
          );
          process.exit(1);
        }

        await integration.executeMetaOrder(orderId, secret);
        break;

      case "demo":
        await integration.demonstrateSolverWorkflow();
        break;

      default:
        console.log("Available commands:");
        console.log(
          "  register-solver <solverAddress> <minQuoteAmount> <maxQuoteAmount> <feePercentage>"
        );
        console.log(
          "  request-quote <fromToken> <toToken> <fromAmount> <deadline>"
        );
        console.log(
          "  generate-quote <requestId> <toAmount> <intentId> <signature>"
        );
        console.log("  execute-order <orderId> <secret>");
        console.log("  demo");
        break;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
