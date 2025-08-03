import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility function for retrying with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetriableError = 
        error.message?.includes('429') || 
        error.message?.includes('Too Many Requests') || 
        error.message?.includes('503') ||
        error.message?.includes('Service Unavailable') ||
        error.message?.includes('502') ||
        error.message?.includes('Bad Gateway') ||
        error.message?.includes('timeout') ||
        error.message?.includes('not valid JSON') ||
        error.message?.includes('invalid json') ||
        error.code === 'SERVER_ERROR' ||
        error.code === 'NETWORK_ERROR' ||
        error.code === 'TIMEOUT' ||
        error.code === 'UNSUPPORTED_OPERATION';
      
      if (i === maxRetries - 1 || !isRetriableError) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      const errorType = error.message?.includes('503') ? 'Service unavailable' : 
                       error.message?.includes('429') ? 'Rate limited' : 'Network error';
      console.log(`⏰ ${errorType}, retrying in ${Math.round(delay/1000)}s... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

async function deployDutchAuction() {
  console.log("🚀 Deploying Dutch Auction Contract to Sepolia...");

  // Prioritize working endpoints based on current status
  const rpcEndpoints = [
    "https://ethereum-sepolia-rpc.publicnode.com", // Most reliable currently
    "https://sepolia.drpc.org", // Also working well
    process.env.ETH_RPC, // Use configured RPC
    "https://1rpc.io/sepolia", // Sometimes has JSON issues
    "https://rpc.sepolia.org",
    "https://rpc2.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://eth-sepolia.g.alchemy.com/v2/demo", // Often rate-limited
  ].filter(Boolean); // Remove any undefined values

  let provider;
  for (const rpc of rpcEndpoints) {
    try {
      console.log(`🔗 Trying RPC: ${rpc}`);
      provider = new ethers.JsonRpcProvider(rpc);
      await retryWithBackoff(() => provider!.getNetwork());
      console.log(`✅ Connected to ${rpc}`);
      break;
    } catch (error: any) {
      console.log(`❌ Failed to connect to ${rpc}:`, error.message);
    }
  }

  if (!provider) {
    throw new Error("Could not connect to any RPC endpoint");
  }

  // Setup wallet
  let privateKey = process.env.ETH_PRIVATE_KEY!;
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`📋 Deploying from address: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("❌ Account has no ETH. Please fund the account first.");
    console.log(`💡 Fund this address: ${wallet.address}`);
    return;
  }

  try {
    // Get HTLC and USDC contract addresses
    const htlcAddress = process.env.HTLC_ETH_ADDRESS;
    const usdcAddress = process.env.USDC_ETH_ADDRESS;

    if (!htlcAddress || !usdcAddress) {
      throw new Error(
        "HTLC_ETH_ADDRESS and USDC_ETH_ADDRESS must be set in .env.sepolia"
      );
    }

    console.log(`🔗 HTLC Contract: ${htlcAddress}`);
    console.log(`💰 USDC Contract: ${usdcAddress}`);

    // Load the compiled contract artifact
    const artifactPath = path.join(
      __dirname,
      "artifacts/contracts/DutchAuction.sol/DutchAuction.json"
    );
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        "DutchAuction artifact not found. Please run 'npx hardhat compile' first."
      );
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const { abi, bytecode } = artifact;

    console.log("📦 Loaded contract artifact successfully");

    // Create contract factory
    const DutchAuctionFactory = new ethers.ContractFactory(
      abi,
      bytecode,
      wallet
    );

    // Deploy contract with retry logic
    console.log("⏳ Deploying Dutch Auction contract...");
    const dutchAuction = await retryWithBackoff(async () => {
      return await DutchAuctionFactory.deploy(
        htlcAddress,
        usdcAddress
      );
    }, 5, 2000); // 5 retries with 2 second base delay

    console.log("⏳ Waiting for deployment confirmation...");
    await retryWithBackoff(async () => {
      return await dutchAuction.waitForDeployment();
    }, 5, 3000); // 5 retries with 3 second base delay

    const deployedAddress = await dutchAuction.getAddress();
    console.log(`✅ Dutch Auction deployed to: ${deployedAddress}`);

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const deployedContract = new ethers.Contract(deployedAddress, abi, wallet);

    const htlcContractAddress = await deployedContract.htlcContract();
    const usdcTokenAddress = await deployedContract.usdcToken();

    console.log(`✅ HTLC Contract verified: ${htlcContractAddress}`);
    console.log(`✅ USDC Token verified: ${usdcTokenAddress}`);

    // Update deployment info
    const deploymentInfo = {
      network: "sepolia",
      dutchAuctionAddress: deployedAddress,
      htlcContractAddress: htlcContractAddress,
      usdcTokenAddress: usdcTokenAddress,
      deployer: wallet.address,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date().toISOString(),
    };

    // Save to deployment file
    const deploymentPath = path.join(__dirname, "deployment-betswap-ai.json");
    let existingDeployment: any = {};
    if (fs.existsSync(deploymentPath)) {
      existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    }

    existingDeployment.dutchAuction = deployedAddress;
    existingDeployment.network = "sepolia";
    existingDeployment.lastUpdated = new Date().toISOString();

    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(existingDeployment, null, 2)
    );

    // Update .env.sepolia
    const envPath = path.join(__dirname, ".env.sepolia");
    const envContent = `\n# Dutch Auction Contract\nDUTCH_AUCTION_ETH_ADDRESS=${deployedAddress}\n`;

    if (fs.existsSync(envPath)) {
      fs.appendFileSync(envPath, envContent);
    } else {
      fs.writeFileSync(envPath, envContent);
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`📝 Contract address saved to deployment-betswap-ai.json`);
    console.log(`📝 Contract address added to .env.sepolia`);
    console.log(
      `\n🔗 View on Etherscan: https://sepolia.etherscan.io/address/${deployedAddress}`
    );
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Run deployment
deployDutchAuction()
  .then(() => {
    console.log("\n✅ Dutch Auction deployment script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
