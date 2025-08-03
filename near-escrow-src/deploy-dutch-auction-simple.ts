import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function deployDutchAuction() {
  console.log("🚀 Deploying Dutch Auction Contract to Sepolia...");

  // Use a reliable RPC endpoint
  const rpcUrl = "https://rpc.sepolia.org";
  console.log(`🔗 Using RPC: ${rpcUrl}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    await provider.getNetwork();
    console.log("✅ Connected to Sepolia network");

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

    // Deploy contract with gas estimation
    console.log("⏳ Deploying Dutch Auction contract...");

    const deploymentTx = await DutchAuctionFactory.deploy(
      htlcAddress,
      usdcAddress,
      {
        gasLimit: 3000000, // Set explicit gas limit
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      }
    );

    console.log("⏳ Waiting for deployment confirmation...");
    console.log(`📝 Transaction hash: ${deploymentTx.hash}`);

    const receipt = await deploymentTx.waitForDeployment();
    const deployedAddress = await deploymentTx.getAddress();

    console.log(`✅ Dutch Auction deployed to: ${deployedAddress}`);
    console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);

    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const deployedContract = new ethers.Contract(deployedAddress, abi, wallet);

    const htlcContractAddress = await deployedContract.htlcContract();
    const usdcTokenAddress = await deployedContract.usdcToken();

    console.log(`✅ HTLC Contract verified: ${htlcContractAddress}`);
    console.log(`✅ USDC Token verified: ${usdcTokenAddress}`);

    // Update deployment info
    const deploymentPath = path.join(__dirname, "deployment-betswap-ai.json");
    let existingDeployment = {};

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

    // Update frontend config
    const frontendConfigPath = path.join(
      __dirname,
      "frontend/config/networks.ts"
    );
    if (fs.existsSync(frontendConfigPath)) {
      let configContent = fs.readFileSync(frontendConfigPath, "utf8");
      configContent = configContent.replace(
        /dutchAuction: "0x[^"]*"/,
        `dutchAuction: "${deployedAddress}"`
      );
      fs.writeFileSync(frontendConfigPath, configContent);
      console.log(`📝 Frontend config updated with new contract address`);
    }

    // Update contracts.ts
    const contractsPath = path.join(__dirname, "frontend/utils/contracts.ts");
    if (fs.existsSync(contractsPath)) {
      let contractsContent = fs.readFileSync(contractsPath, "utf8");
      contractsContent = contractsContent.replace(
        /"0x0000000000000000000000000000000000000000", \/\/ Mock address for testing/,
        `"${deployedAddress}", // Dutch Auction address (Sepolia)`
      );
      fs.writeFileSync(contractsPath, contractsContent);
      console.log(`📝 Frontend contracts.ts updated with new contract address`);
    }
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
