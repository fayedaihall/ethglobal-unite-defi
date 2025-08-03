import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployDutchAuction() {
  console.log("🚀 Deploying Dutch Auction Contract...");

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

  // Ensure private key has 0x prefix
  let privateKey = process.env.ETH_PRIVATE_KEY!;
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📋 Deploying from address: ${wallet.address}`);
  console.log(`🌐 Network: ${await provider.getNetwork()}`);

  try {
    // Get HTLC and USDC contract addresses
    const htlcAddress = process.env.HTLC_ETH_ADDRESS;
    const usdcAddress = process.env.USDC_ETH_ADDRESS;

    if (!htlcAddress || !usdcAddress) {
      throw new Error(
        "HTLC_ETH_ADDRESS and USDC_ETH_ADDRESS must be set in .env"
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

    // Deploy contract
    console.log("⏳ Deploying Dutch Auction contract...");
    const dutchAuction = await DutchAuctionFactory.deploy(
      htlcAddress,
      usdcAddress
    );

    console.log("⏳ Waiting for deployment confirmation...");
    await dutchAuction.waitForDeployment();

    const deployedAddress = await dutchAuction.getAddress();
    console.log(`✅ Dutch Auction deployed to: ${deployedAddress}`);

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const deployedContract = new ethers.Contract(deployedAddress, abi, wallet);

    const htlcContractAddress = await deployedContract.htlcContract();
    const usdcTokenAddress = await deployedContract.usdcToken();

    console.log(`✅ HTLC Contract verified: ${htlcContractAddress}`);
    console.log(`✅ USDC Token verified: ${usdcTokenAddress}`);

    // Save deployment info
    const deploymentInfo = {
      network: (await provider.getNetwork()).name,
      dutchAuctionAddress: deployedAddress,
      htlcContractAddress: htlcContractAddress,
      usdcTokenAddress: usdcTokenAddress,
      deployer: wallet.address,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date().toISOString(),
    };

    console.log("\n📋 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Save to .env file
    const envContent = `\n# Dutch Auction Contract\nDUTCH_AUCTION_ETH_ADDRESS=${deployedAddress}\n`;

    console.log("\n💾 Add the following to your .env file:");
    console.log(envContent);

    // Save deployment info to file
    const deploymentPath = path.join(__dirname, "deployment-info.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Deployment info saved to: ${deploymentPath}`);

    return deploymentInfo;
  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.transaction) {
      console.error("Transaction:", error.transaction);
    }
    process.exit(1);
  }
}

// Run deployment
deployDutchAuction().catch(console.error);
