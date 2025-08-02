import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.sepolia";
dotenv.config({ path: envFile });

async function main() {
  console.log("🚀 Deploying BetSwap AI Contracts...\n");

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

  let privateKey = process.env.ETH_PRIVATE_KEY!;
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📋 Deploying from address: ${wallet.address}`);
  console.log(`🌐 Network: ${await provider.getNetwork()}`);

  // Get existing contract addresses
  const htlcAddress = process.env.HTLC_ETH_ADDRESS;
  const usdcAddress = process.env.USDC_ETH_ADDRESS;
  const dutchAuctionAddress = process.env.DUTCH_AUCTION_ETH_ADDRESS;
  const solverAddress = process.env.SHADE_AGENT_SOLVER_ETH_ADDRESS;

  if (!htlcAddress || !usdcAddress || !dutchAuctionAddress || !solverAddress) {
    throw new Error(
      "HTLC_ETH_ADDRESS, USDC_ETH_ADDRESS, DUTCH_AUCTION_ETH_ADDRESS, and SHADE_AGENT_SOLVER_ETH_ADDRESS must be set in .env"
    );
  }

  console.log(`✅ Using existing contracts:`);
  console.log(`   HTLC: ${htlcAddress}`);
  console.log(`   USDC: ${usdcAddress}`);
  console.log(`   Dutch Auction: ${dutchAuctionAddress}`);
  console.log(`   Shade Agent Solver: ${solverAddress}`);

  // Deploy BetToken
  console.log("\n📦 Deploying BetToken...");
  const betTokenArtifactPath = path.join(
    __dirname,
    "artifacts/contracts/BetToken.sol/BetToken.json"
  );

  if (!fs.existsSync(betTokenArtifactPath)) {
    throw new Error(
      "BetToken artifact not found. Please compile the contracts first."
    );
  }

  const betTokenArtifact = JSON.parse(
    fs.readFileSync(betTokenArtifactPath, "utf8")
  );
  const { abi: betTokenAbi, bytecode: betTokenBytecode } = betTokenArtifact;

  const BetTokenFactory = new ethers.ContractFactory(
    betTokenAbi,
    betTokenBytecode,
    wallet
  );

  const betToken = await BetTokenFactory.deploy();
  await betToken.waitForDeployment();
  const betTokenAddress = await betToken.getAddress();

  console.log(`✅ BetToken deployed to: ${betTokenAddress}`);

  // Deploy BetSwapAI
  console.log("\n📦 Deploying BetSwapAI...");
  const betSwapAIArtifactPath = path.join(
    __dirname,
    "artifacts/contracts/BetSwapAI.sol/BetSwapAI.json"
  );

  if (!fs.existsSync(betSwapAIArtifactPath)) {
    throw new Error(
      "BetSwapAI artifact not found. Please compile the contracts first."
    );
  }

  const betSwapAIArtifact = JSON.parse(
    fs.readFileSync(betSwapAIArtifactPath, "utf8")
  );
  const { abi: betSwapAIAbi, bytecode: betSwapAIBytecode } = betSwapAIArtifact;

  const BetSwapAIFactory = new ethers.ContractFactory(
    betSwapAIAbi,
    betSwapAIBytecode,
    wallet
  );

  const betSwapAI = await BetSwapAIFactory.deploy(
    betTokenAddress,
    htlcAddress,
    dutchAuctionAddress,
    solverAddress
  );
  await betSwapAI.waitForDeployment();
  const betSwapAIAddress = await betSwapAI.getAddress();

  console.log(`✅ BetSwapAI deployed to: ${betSwapAIAddress}`);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const deployedBetSwapAI = new ethers.Contract(
    betSwapAIAddress,
    betSwapAIAbi,
    wallet
  );

  const betTokenContract = await deployedBetSwapAI.betToken();
  const htlcContract = await deployedBetSwapAI.htlcContract();
  const dutchAuctionContract = await deployedBetSwapAI.dutchAuctionContract();
  const solverContract = await deployedBetSwapAI.solverContract();

  console.log(`✅ BetToken verified: ${betTokenContract}`);
  console.log(`✅ HTLC Contract verified: ${htlcContract}`);
  console.log(`✅ Dutch Auction Contract verified: ${dutchAuctionContract}`);
  console.log(`✅ Solver Contract verified: ${solverContract}`);

  // Save deployment info
  const deploymentInfo = {
    network: (await provider.getNetwork()).name,
    deployer: wallet.address,
    contracts: {
      betToken: betTokenAddress,
      betSwapAI: betSwapAIAddress,
      htlc: htlcAddress,
      usdc: usdcAddress,
      dutchAuction: dutchAuctionAddress,
      solver: solverAddress,
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "deployment-betswap-ai.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n📄 Deployment info saved to: ${deploymentPath}`);

  // Update environment file
  const envPath =
    process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.sepolia";
  const envContent = fs.readFileSync(envPath, "utf8");

  const updatedEnvContent = envContent
    .replace(
      /BET_TOKEN_ETH_ADDRESS=.*/g,
      `BET_TOKEN_ETH_ADDRESS=${betTokenAddress}`
    )
    .replace(
      /BETSWAP_AI_ETH_ADDRESS=.*/g,
      `BETSWAP_AI_ETH_ADDRESS=${betSwapAIAddress}`
    );

  fs.writeFileSync(envPath, updatedEnvContent);

  console.log(`✅ Environment file updated: ${envPath}`);

  console.log("\n🎉 BetSwap AI Deployment Complete!");
  console.log("\n📋 Contract Addresses:");
  console.log(`   BetToken: ${betTokenAddress}`);
  console.log(`   BetSwapAI: ${betSwapAIAddress}`);
  console.log(`   HTLC: ${htlcAddress}`);
  console.log(`   USDC: ${usdcAddress}`);
  console.log(`   Dutch Auction: ${dutchAuctionAddress}`);
  console.log(`   Shade Agent Solver: ${solverAddress}`);

  console.log("\n🔗 Etherscan Links:");
  console.log(
    `   BetToken: https://sepolia.etherscan.io/address/${betTokenAddress}`
  );
  console.log(
    `   BetSwapAI: https://sepolia.etherscan.io/address/${betSwapAIAddress}`
  );
}

main()
  .then(() => {
    console.log("\n✅ Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
