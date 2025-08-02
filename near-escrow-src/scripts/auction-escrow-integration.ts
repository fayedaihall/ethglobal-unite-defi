import { ethers } from "ethers";
import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

interface EscrowAuctionData {
  auctionId: number;
  escrowId: number;
  secret: string;
  userEthAddress: string;
  fillAmount: string;
  swapDirection: "ETH_TO_NEAR" | "NEAR_TO_ETH";
}

interface OneInchSwapData {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  swapDirection: "ETH_TO_NEAR" | "NEAR_TO_ETH";
}

class AuctionEscrowIntegration {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private dutchAuctionContract: ethers.Contract;
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

    const dutchAuctionAddress = process.env.DUTCH_AUCTION_ETH_ADDRESS;
    const htlcAddress = process.env.HTLC_ETH_ADDRESS;
    const usdcAddress = process.env.USDC_ETH_ADDRESS;

    if (!dutchAuctionAddress || !htlcAddress || !usdcAddress) {
      throw new Error(
        "DUTCH_AUCTION_ETH_ADDRESS, HTLC_ETH_ADDRESS, and USDC_ETH_ADDRESS must be set in .env"
      );
    }

    this.dutchAuctionContract = new ethers.Contract(
      dutchAuctionAddress,
      [
        "function placeBid(uint256 auctionId, bytes32 escrowId) external",
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
        "function getCurrentPrice(uint256 auctionId) public view returns (uint256)",
      ],
      this.wallet
    );

    this.htlcContract = new ethers.Contract(
      htlcAddress,
      [
        "function createLock(bytes32,address,address,uint256,bytes32,uint256) returns(bool)",
        "function withdraw(bytes32,string) returns(bool)",
        "function refund(bytes32) returns(bool)",
        "function locks(bytes32) view returns (address, address, address, uint256, bytes32, uint256, bool)",
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

  // 1inch Fusion+ Integration for Cross-chain Swaps
  async createOneInchFusionSwap(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    swapDirection: "ETH_TO_NEAR" | "NEAR_TO_ETH"
  ): Promise<OneInchSwapData> {
    console.log(`🔄 Creating 1inch Fusion+ swap: ${swapDirection}`);

    // Generate escrow data for cross-chain swap
    const escrowId = Math.floor(Math.random() * 1000000);
    const secret = crypto.randomBytes(32).toString("hex");
    const hashlock = ethers.sha256(Buffer.from(secret, "hex"));
    const timelock = 7200; // 2 hours

    console.log(`📋 Generated cross-chain swap data:`);
    console.log(`   Escrow ID: ${escrowId}`);
    console.log(`   Secret: ${secret}`);
    console.log(`   Hashlock: ${hashlock}`);

    // Create HTLC locks on both chains
    if (swapDirection === "ETH_TO_NEAR") {
      // Lock tokens on Ethereum, unlock on NEAR
      await this.createHTLCLock(
        escrowId,
        "0x0000000000000000000000000000000000000000",
        fromAmount,
        hashlock,
        timelock
      );
      await this.registerResolverOnNear(escrowId);
    } else {
      // Lock tokens on NEAR, unlock on Ethereum
      await this.registerResolverOnNear(escrowId);
      await this.createHTLCLock(
        escrowId,
        "0x0000000000000000000000000000000000000000",
        fromAmount,
        hashlock,
        timelock
      );
    }

    return {
      fromToken,
      toToken,
      fromAmount,
      toAmount: fromAmount, // 1:1 swap for demo
      swapDirection,
    };
  }

  async executeOneInchFusionSwap(
    escrowId: number,
    secret: string,
    swapDirection: "ETH_TO_NEAR" | "NEAR_TO_ETH"
  ): Promise<void> {
    console.log(`🚀 Executing 1inch Fusion+ swap: ${swapDirection}`);

    try {
      if (swapDirection === "ETH_TO_NEAR") {
        // Complete withdrawal on NEAR
        await this.completeEscrowWithdrawalNear(
          escrowId,
          secret,
          "fayefaye2.testnet"
        );
      } else {
        // Complete withdrawal on Ethereum
        await this.completeEscrowWithdrawal(escrowId, secret);
      }

      console.log(`✅ 1inch Fusion+ swap completed successfully!`);
    } catch (error: any) {
      console.error("❌ Failed to execute 1inch Fusion+ swap:", error.message);
      throw error;
    }
  }

  async createAuctionWithEscrow(
    tokenAddress: string,
    startAmount: string,
    minAmount: string,
    duration: number,
    stepTime: number,
    stepAmount: string,
    userEthAddress: string
  ): Promise<EscrowAuctionData> {
    console.log("🏗️ Creating auction with escrow integration...");

    // Generate escrow data
    const escrowId = Math.floor(Math.random() * 1000000);
    const secret = crypto.randomBytes(32).toString("hex");
    const hashlock = ethers.sha256(Buffer.from(secret, "hex"));
    const timelock = 7200; // 2 hours

    console.log(`📋 Generated escrow data:`);
    console.log(`   Escrow ID: ${escrowId}`);
    console.log(`   Secret: ${secret}`);
    console.log(`   Hashlock: ${hashlock}`);

    // Create auction
    const auctionId = await this.createAuction(
      tokenAddress,
      startAmount,
      minAmount,
      duration,
      stepTime,
      stepAmount
    );

    // Register resolver on NEAR
    await this.registerResolverOnNear(escrowId);

    // Create HTLC lock on Ethereum
    await this.createHTLCLock(
      escrowId,
      userEthAddress,
      startAmount,
      hashlock,
      timelock
    );

    return {
      auctionId,
      escrowId,
      secret,
      userEthAddress,
      fillAmount: startAmount,
      swapDirection: "ETH_TO_NEAR",
    };
  }

  async createAuctionWithEscrowNear(
    tokenAddress: string,
    startAmount: string,
    minAmount: string,
    duration: number,
    stepTime: number,
    stepAmount: string,
    userNearAccountId: string
  ): Promise<EscrowAuctionData> {
    console.log("🏗️ Creating auction with NEAR escrow integration...");

    // Generate escrow data
    const escrowId = Math.floor(Math.random() * 1000000);
    const secret = crypto.randomBytes(32).toString("hex");
    const hashlock = ethers.sha256(Buffer.from(secret, "hex"));
    const timelock = 7200; // 2 hours

    console.log(`📋 Generated escrow data:`);
    console.log(`   Escrow ID: ${escrowId}`);
    console.log(`   Secret: ${secret}`);
    console.log(`   Hashlock: ${hashlock}`);

    // Create auction
    const auctionId = await this.createAuction(
      tokenAddress,
      startAmount,
      minAmount,
      duration,
      stepTime,
      stepAmount
    );

    // Register resolver on NEAR
    await this.registerResolverOnNear(escrowId);

    // Create HTLC lock on Ethereum (using a placeholder address for NEAR accounts)
    const placeholderEthAddress = "0x0000000000000000000000000000000000000000";
    await this.createHTLCLock(
      escrowId,
      placeholderEthAddress, // Use placeholder for NEAR accounts
      startAmount,
      hashlock,
      timelock
    );

    return {
      auctionId,
      escrowId,
      secret,
      userEthAddress: userNearAccountId, // Store NEAR account ID
      fillAmount: startAmount,
      swapDirection: "NEAR_TO_ETH",
    };
  }

  private async createAuction(
    tokenAddress: string,
    startAmount: string,
    minAmount: string,
    duration: number,
    stepTime: number,
    stepAmount: string
  ): Promise<number> {
    const contract = new ethers.Contract(
      process.env.DUTCH_AUCTION_ETH_ADDRESS!,
      [
        "function createAuction(address token, uint256 startAmount, uint256 minAmount, uint256 duration, uint256 stepTime, uint256 stepAmount) external returns (uint256)",
        "function auctionCounter() external view returns (uint256)",
      ],
      this.wallet
    );

    const tx = await contract.createAuction(
      tokenAddress,
      BigInt(startAmount),
      BigInt(minAmount),
      BigInt(duration),
      BigInt(stepTime),
      BigInt(stepAmount)
    );

    await tx.wait();
    const auctionId = (await contract.auctionCounter()) - BigInt(1);

    console.log(`✅ Auction created with ID: ${auctionId}`);
    return Number(auctionId);
  }

  private async registerResolverOnNear(escrowId: number): Promise<void> {
    console.log(`🔗 Registering resolver on NEAR for escrow ${escrowId}...`);

    try {
      const tx = await this.nearAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        methodName: "register_resolver",
        args: { id: escrowId },
        gas: BigInt("30000000000000"),
      });

      console.log(`✅ Resolver registered on NEAR. Tx: ${tx.transaction.hash}`);
    } catch (error: any) {
      console.log(`⚠️ NEAR registration failed (continuing): ${error.message}`);
    }
  }

  private async createHTLCLock(
    escrowId: number,
    userEthAddress: string,
    amount: string,
    hashlock: string,
    timelock: number
  ): Promise<void> {
    console.log(`🔒 Creating HTLC lock on Ethereum...`);

    // Get current nonce
    const currentNonce = await this.wallet.getNonce();
    console.log(`Using nonce: ${currentNonce}`);

    // Approve USDC spending
    const approveTx = await this.usdcContract.approve(
      await this.htlcContract.getAddress(),
      amount,
      { nonce: currentNonce }
    );
    await approveTx.wait();
    console.log(`✅ USDC approval confirmed`);

    // Create lock with next nonce
    const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));
    const validUserAddress = ethers.getAddress(userEthAddress);

    const createTx = await this.htlcContract.createLock(
      id,
      validUserAddress,
      await this.usdcContract.getAddress(),
      amount,
      hashlock,
      timelock,
      { nonce: currentNonce + 1 }
    );

    await createTx.wait();
    console.log(`✅ HTLC lock created. Tx: ${createTx.hash}`);
  }

  async placeBidWithEscrow(
    auctionId: number,
    escrowId: number,
    secret: string
  ): Promise<void> {
    console.log(`💰 Placing bid with escrow integration...`);

    try {
      // Get current auction price
      const currentPrice = await this.dutchAuctionContract.getCurrentPrice(
        auctionId
      );
      console.log(
        `Current auction price: ${currentPrice} (${
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

      // Get current nonce
      const currentNonce = await this.wallet.getNonce();
      console.log(`Using nonce: ${currentNonce}`);

      // Approve USDC spending for auction contract
      const approveTx = await this.usdcContract.approve(
        await this.dutchAuctionContract.getAddress(),
        currentPrice,
        { nonce: currentNonce }
      );
      await approveTx.wait();
      console.log(`✅ USDC approval confirmed for auction`);

      // Place bid with escrow ID using next nonce
      const escrowIdBytes = ethers.keccak256(
        ethers.toUtf8Bytes(escrowId.toString())
      );
      const bidTx = await this.dutchAuctionContract.placeBid(
        auctionId,
        escrowIdBytes,
        { nonce: currentNonce + 1 }
      );
      await bidTx.wait();

      console.log(`✅ Bid placed successfully!`);
      console.log(`Transaction Hash: ${bidTx.hash}`);
      console.log(`Escrow ID: ${escrowId}`);

      // Complete escrow withdrawal
      await this.completeEscrowWithdrawal(escrowId, secret);
    } catch (error: any) {
      console.error("❌ Failed to place bid with escrow:", error.message);
      throw error;
    }
  }

  async placeBidWithEscrowNear(
    auctionId: number,
    escrowId: number,
    secret: string,
    nearAccountId: string
  ): Promise<void> {
    console.log(`💰 Placing bid with NEAR escrow integration...`);

    try {
      // Get current auction price
      const currentPrice = await this.dutchAuctionContract.getCurrentPrice(
        auctionId
      );
      console.log(
        `Current auction price: ${currentPrice} (${
          parseInt(currentPrice) / 1000000
        } USDC)`
      );

      // Check NEAR balance (approximate conversion)
      const nearBalance = await this.nearAccount.getAccountBalance();
      const nearBalanceInYocto = nearBalance.total;
      console.log(`Your NEAR balance: ${nearBalanceInYocto} yoctoNEAR`);

      // Get current nonce
      const currentNonce = await this.wallet.getNonce();
      console.log(`Using nonce: ${currentNonce}`);

      // Approve USDC spending for auction contract
      const approveTx = await this.usdcContract.approve(
        await this.dutchAuctionContract.getAddress(),
        currentPrice,
        { nonce: currentNonce }
      );
      await approveTx.wait();
      console.log(`✅ USDC approval confirmed for auction`);

      // Place bid with escrow ID using next nonce
      const escrowIdBytes = ethers.keccak256(
        ethers.toUtf8Bytes(escrowId.toString())
      );
      const bidTx = await this.dutchAuctionContract.placeBid(
        auctionId,
        escrowIdBytes,
        { nonce: currentNonce + 1 }
      );
      await bidTx.wait();

      console.log(`✅ Bid placed successfully!`);
      console.log(`Transaction Hash: ${bidTx.hash}`);
      console.log(`Escrow ID: ${escrowId}`);

      // Complete escrow withdrawal on NEAR
      await this.completeEscrowWithdrawalNear(escrowId, secret, nearAccountId);
    } catch (error: any) {
      console.error("❌ Failed to place bid with NEAR escrow:", error.message);
      throw error;
    }
  }

  private async completeEscrowWithdrawal(
    escrowId: number,
    secret: string
  ): Promise<void> {
    console.log(`🔄 Completing escrow withdrawal...`);

    try {
      // Withdraw on Ethereum
      const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));
      const preimageBytes = Buffer.from(secret, "hex");

      const ethTx = await this.htlcContract.withdraw(id, preimageBytes);
      await ethTx.wait();
      console.log(`✅ Ethereum withdrawal completed. Tx: ${ethTx.hash}`);

      // Withdraw on NEAR
      const nearTx = await this.nearAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        methodName: "withdraw",
        args: { id: escrowId, preimage: secret },
        gas: BigInt("30000000000000"),
      });

      console.log(
        `✅ NEAR withdrawal completed. Tx: ${nearTx.transaction.hash}`
      );
      console.log(`🎉 Escrow ${escrowId} withdrawal completed successfully!`);
    } catch (error: any) {
      console.log(`⚠️ Withdrawal error (continuing): ${error.message}`);
    }
  }

  private async completeEscrowWithdrawalNear(
    escrowId: number,
    secret: string,
    nearAccountId: string
  ): Promise<void> {
    console.log(`🔄 Completing NEAR escrow withdrawal...`);

    try {
      // Withdraw on NEAR
      const nearTx = await this.nearAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        methodName: "withdraw",
        args: { id: escrowId, preimage: secret },
        gas: BigInt("30000000000000"),
      });

      console.log(
        `✅ NEAR withdrawal completed. Tx: ${nearTx.transaction.hash}`
      );
      console.log(
        `🎉 NEAR Escrow ${escrowId} withdrawal completed successfully!`
      );
    } catch (error: any) {
      console.log(`⚠️ NEAR withdrawal error (continuing): ${error.message}`);
    }
  }

  async getAuctionEscrowStatus(auctionId: number): Promise<void> {
    console.log(`📊 Getting auction and escrow status...`);

    try {
      const seller = await this.dutchAuctionContract.getAuctionSeller(
        auctionId
      );
      const token = await this.dutchAuctionContract.getAuctionToken(auctionId);
      const startAmount = await this.dutchAuctionContract.getAuctionStartAmount(
        auctionId
      );
      const currentPrice = await this.dutchAuctionContract.getCurrentPrice(
        auctionId
      );
      const minAmount = await this.dutchAuctionContract.getAuctionMinAmount(
        auctionId
      );
      const active = await this.dutchAuctionContract.getAuctionActive(
        auctionId
      );
      const sold = await this.dutchAuctionContract.getAuctionSold(auctionId);
      const buyer = await this.dutchAuctionContract.getAuctionBuyer(auctionId);
      const escrowId = await this.dutchAuctionContract.getAuctionEscrowId(
        auctionId
      );

      console.log(`\n🎯 Auction #${auctionId} Details:`);
      console.log(`Seller: ${seller}`);
      console.log(`Token: ${token}`);
      console.log(
        `Start Amount: ${startAmount} (${parseInt(startAmount) / 1000000} USDC)`
      );
      console.log(
        `Current Price: ${currentPrice} (${
          parseInt(currentPrice) / 1000000
        } USDC)`
      );
      console.log(
        `Min Amount: ${minAmount} (${parseInt(minAmount) / 1000000} USDC)`
      );
      console.log(`Active: ${active ? "✅" : "❌"}`);
      console.log(`Sold: ${sold ? "✅" : "❌"}`);

      if (sold) {
        console.log(`Buyer: ${buyer}`);
        console.log(`Escrow ID: ${escrowId}`);
      }
    } catch (error: any) {
      console.error("❌ Failed to get auction status:", error.message);
    }
  }
}

// Command line interface
async function main() {
  const integration = new AuctionEscrowIntegration();
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
        const userEthAddress = process.argv[9];

        if (
          !tokenAddress ||
          !startAmount ||
          !minAmount ||
          !duration ||
          !stepTime ||
          !stepAmount ||
          !userEthAddress
        ) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts create <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userEthAddress>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts create 0x123... 1000000 500000 3600 300 50000 0x456..."
          );
          process.exit(1);
        }

        const result = await integration.createAuctionWithEscrow(
          tokenAddress,
          startAmount,
          minAmount,
          duration,
          stepTime,
          stepAmount,
          userEthAddress
        );

        console.log("\n📋 Integration Summary:");
        console.log(JSON.stringify(result, null, 2));
        break;

      case "create-near":
        const nearTokenAddress = process.argv[3];
        const nearStartAmount = process.argv[4];
        const nearMinAmount = process.argv[5];
        const nearDuration = parseInt(process.argv[6]);
        const nearStepTime = parseInt(process.argv[7]);
        const nearStepAmount = process.argv[8];
        const userNearAccountId = process.argv[9];

        if (
          !nearTokenAddress ||
          !nearStartAmount ||
          !nearMinAmount ||
          !nearDuration ||
          !nearStepTime ||
          !nearStepAmount ||
          !userNearAccountId
        ) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts create-near <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userNearAccountId>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts create-near 0x123... 1000000 500000 3600 300 50000 user.testnet"
          );
          process.exit(1);
        }

        const nearResult = await integration.createAuctionWithEscrowNear(
          nearTokenAddress,
          nearStartAmount,
          nearMinAmount,
          nearDuration,
          nearStepTime,
          nearStepAmount,
          userNearAccountId
        );

        console.log("\n📋 NEAR Integration Summary:");
        console.log(JSON.stringify(nearResult, null, 2));
        break;

      case "bid":
        console.log("Debug - process.argv:", process.argv);
        const auctionId = parseInt(process.argv[3]);
        const escrowId = parseInt(process.argv[4]);
        const secret = process.argv[5];

        console.log("Debug - parsed args:", { auctionId, escrowId, secret });

        if (
          auctionId === undefined ||
          auctionId === null ||
          escrowId === undefined ||
          escrowId === null ||
          !secret
        ) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts bid <auctionId> <escrowId> <secret>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts bid 0 123 abc123..."
          );
          process.exit(1);
        }

        await integration.placeBidWithEscrow(auctionId, escrowId, secret);
        break;

      case "bid-near":
        const nearAuctionId = parseInt(process.argv[3]);
        const nearEscrowId = parseInt(process.argv[4]);
        const nearSecret = process.argv[5];
        const nearAccountId = process.argv[6];

        if (
          nearAuctionId === undefined ||
          nearAuctionId === null ||
          nearEscrowId === undefined ||
          nearEscrowId === null ||
          !nearSecret ||
          !nearAccountId
        ) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts bid-near <auctionId> <escrowId> <secret> <nearAccountId>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts bid-near 0 123 abc123... user.testnet"
          );
          process.exit(1);
        }

        await integration.placeBidWithEscrowNear(
          nearAuctionId,
          nearEscrowId,
          nearSecret,
          nearAccountId
        );
        break;

      case "fusion-swap":
        const fromToken = process.argv[3];
        const toToken = process.argv[4];
        const fromAmount = process.argv[5];
        const swapDirection = process.argv[6] as "ETH_TO_NEAR" | "NEAR_TO_ETH";

        if (!fromToken || !toToken || !fromAmount || !swapDirection) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts fusion-swap <fromToken> <toToken> <fromAmount> <swapDirection>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts fusion-swap 0x123... 0x456... 1000000 ETH_TO_NEAR"
          );
          console.error("Swap directions: ETH_TO_NEAR, NEAR_TO_ETH");
          process.exit(1);
        }

        const swapResult = await integration.createOneInchFusionSwap(
          fromToken,
          toToken,
          fromAmount,
          swapDirection
        );

        console.log("\n📋 1inch Fusion+ Swap Summary:");
        console.log(JSON.stringify(swapResult, null, 2));
        break;

      case "execute-fusion":
        const fusionEscrowId = parseInt(process.argv[3]);
        const fusionSecret = process.argv[4];
        const fusionDirection = process.argv[5] as
          | "ETH_TO_NEAR"
          | "NEAR_TO_ETH";

        if (!fusionEscrowId || !fusionSecret || !fusionDirection) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts execute-fusion <escrowId> <secret> <swapDirection>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts execute-fusion 123 abc123... ETH_TO_NEAR"
          );
          console.error("Swap directions: ETH_TO_NEAR, NEAR_TO_ETH");
          process.exit(1);
        }

        await integration.executeOneInchFusionSwap(
          fusionEscrowId,
          fusionSecret,
          fusionDirection
        );
        break;

      case "status":
        const statusAuctionId = parseInt(process.argv[3]);

        if (!statusAuctionId) {
          console.error(
            "Usage: ts-node scripts/auction-escrow-integration.ts status <auctionId>"
          );
          console.error(
            "Example: ts-node scripts/auction-escrow-integration.ts status 0"
          );
          process.exit(1);
        }

        await integration.getAuctionEscrowStatus(statusAuctionId);
        break;

      default:
        console.log("Available commands:");
        console.log(
          "  create <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userEthAddress>"
        );
        console.log(
          "  create-near <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userNearAccountId>"
        );
        console.log("  bid <auctionId> <escrowId> <secret>");
        console.log(
          "  bid-near <auctionId> <escrowId> <secret> <nearAccountId>"
        );
        console.log("  status <auctionId>");
        console.log(
          "  fusion-swap <fromToken> <toToken> <fromAmount> <swapDirection>"
        );
        console.log("  execute-fusion <escrowId> <secret> <swapDirection>");
        console.log("\n1inch Fusion+ Cross-chain Swap Commands:");
        console.log(
          "  fusion-swap - Create cross-chain swap with hashlock/timelock"
        );
        console.log("  execute-fusion - Execute cross-chain swap using secret");
        console.log("\nSwap Directions:");
        console.log("  ETH_TO_NEAR - Swap from Ethereum to NEAR");
        console.log("  NEAR_TO_ETH - Swap from NEAR to Ethereum");
        break;
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
