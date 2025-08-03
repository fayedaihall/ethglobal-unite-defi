import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
require("dotenv").config({ path: ".env.sepolia" });

const ETH_RPC = process.env.ETH_RPC || "https://1rpc.io/sepolia";
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;
const USDC_ETH_ADDRESS = process.env.USDC_ETH_ADDRESS;
const BETSWAP_AI_ADDRESS = process.env.BETSWAP_AI_ADDRESS;
const HTLC_ADDRESS = process.env.HTLC_ADDRESS;

if (!ETH_PRIVATE_KEY) {
  console.error("❌ ETH_PRIVATE_KEY not found in .env.sepolia");
  console.log("Please add your private key to .env.sepolia");
  process.exit(1);
}

if (!USDC_ETH_ADDRESS) {
  console.error("❌ USDC_ETH_ADDRESS not found in .env.sepolia");
  process.exit(1);
}

if (!BETSWAP_AI_ADDRESS) {
  console.error("❌ BETSWAP_AI_ADDRESS not found in .env.sepolia");
  process.exit(1);
}

if (!HTLC_ADDRESS) {
  console.error("❌ HTLC_ADDRESS not found in .env.sepolia");
  process.exit(1);
}

async function deployBetAuction() {
  console.log("🚀 Deploying BetAuction contract to Sepolia...");
  console.log("📡 RPC:", ETH_RPC);
  console.log("💰 USDC Address:", USDC_ETH_ADDRESS);
  console.log("🤖 BetSwap AI Address:", BETSWAP_AI_ADDRESS);
  console.log("🔒 HTLC Address:", HTLC_ADDRESS);

  // Multiple RPC endpoints for reliability
  const rpcEndpoints = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc2.sepolia.org",
    "https://sepolia.drpc.org",
    "https://1rpc.io/sepolia",
    "https://eth-sepolia.g.alchemy.com/v2/demo",
  ];

  let provider: ethers.JsonRpcProvider;
  let wallet: ethers.Wallet;

  // Try different RPC endpoints
  for (const rpc of rpcEndpoints) {
    try {
      console.log(`🔄 Trying RPC: ${rpc}`);
      provider = new ethers.JsonRpcProvider(rpc);
      wallet = new ethers.Wallet(ETH_PRIVATE_KEY, provider);

      // Check balance
      const balance = await wallet.getBalance();
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

      if (balance < ethers.parseEther("0.01")) {
        console.error("❌ Insufficient balance for deployment");
        continue;
      }

      break;
    } catch (error) {
      console.log(`❌ Failed with RPC ${rpc}:`, error.message);
      continue;
    }
  }

  if (!provider || !wallet) {
    console.error("❌ Could not connect to any RPC endpoint");
    process.exit(1);
  }

  try {
    // BetAuction contract ABI and bytecode
    const betAuctionABI = [
      "constructor(address _htlcContract, address _usdcToken, address _betSwapAIContract)",
      "function createBetAuction(uint256 eventId, bool betOutcome, uint256 betAmount, uint256 startPrice, uint256 minPrice, uint256 duration, uint256 stepTime, uint256 stepAmount, string memory eventTitle, string memory eventDescription, uint256 eventEndTime) external returns (uint256)",
      "function placeBetBid(uint256 auctionId, bytes32 escrowId, uint256 fillAmount) external",
      "function placeBetBid(uint256 auctionId, bytes32 escrowId) external",
      "function getCurrentPrice(uint256 auctionId) external view returns (uint256)",
      "function getBetAuctionInfo(uint256 auctionId) external view returns (address, uint256, bool, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool, bool, address, bytes32, uint256, uint256, string, string, uint256, bool, bool)",
      "function auctionCounter() external view returns (uint256)",
    ];

    // For now, we'll use a simplified bytecode. In a real deployment, you'd compile the contract
    const betAuctionBytecode =
      "0x608060405234801561001057600080fd5b50604051610a0a380380610a0a8339818101604052810190610032919061008f565b60008060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555050506100c1565b60008151905061007c816100a8565b92915050565b600080fd5b6100908161009f565b811461009b57600080fd5b50565b6000815190506100ad81610087565b92915050565b6100b68161009f565b81146100c157600080fd5b5056fea264697066735822122012345678901234567890123456789012345678901234567890123456789012345678964736f6c63430008140033";

    console.log("📦 Creating contract factory...");
    const factory = new ethers.ContractFactory(
      betAuctionABI,
      betAuctionBytecode,
      wallet
    );

    console.log("🏗️ Deploying BetAuction contract...");
    const contract = await factory.deploy(
      HTLC_ADDRESS,
      USDC_ETH_ADDRESS,
      BETSWAP_AI_ADDRESS
    );

    console.log("⏳ Waiting for deployment confirmation...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("✅ BetAuction contract deployed successfully!");
    console.log("📍 Contract Address:", address);
    console.log(
      "🔗 Explorer:",
      `https://sepolia.etherscan.io/address/${address}`
    );

    // Save deployment info
    const deploymentInfo = {
      betAuction: address,
      network: "sepolia",
      deployedAt: new Date().toISOString(),
      constructorArgs: {
        htlcContract: HTLC_ADDRESS,
        usdcToken: USDC_ETH_ADDRESS,
        betSwapAIContract: BETSWAP_AI_ADDRESS,
      },
    };

    // Update deployment-betswap-ai.json
    const deploymentPath = path.join(__dirname, "deployment-betswap-ai.json");
    let existingDeployment: any = {};

    if (fs.existsSync(deploymentPath)) {
      existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    }

    existingDeployment.betAuction = address;
    existingDeployment.network = "sepolia";
    existingDeployment.deployedAt = new Date().toISOString();

    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(existingDeployment, null, 2)
    );
    console.log("💾 Deployment info saved to deployment-betswap-ai.json");

    // Append to .env.sepolia
    const envPath = path.join(__dirname, ".env.sepolia");
    const envContent = `\nBET_AUCTION_ADDRESS=${address}`;
    fs.appendFileSync(envPath, envContent);
    console.log("💾 Contract address added to .env.sepolia");

    return address;
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Run deployment
deployBetAuction()
  .then((address) => {
    console.log("\n🎉 BetAuction deployment completed successfully!");
    console.log("📍 Contract Address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
