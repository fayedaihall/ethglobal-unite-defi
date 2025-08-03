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

async function deployShadeAgentSolver() {
  console.log("🚀 Deploying Shade Agent Solver Contract...");

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

  let privateKey = process.env.ETH_PRIVATE_KEY!;
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`📋 Deploying from address: ${wallet.address}`);
  console.log(`🌐 Network: ${await provider.getNetwork()}`);

  // Get contract addresses
  const htlcAddress = process.env.HTLC_ETH_ADDRESS;
  const usdcAddress = process.env.USDC_ETH_ADDRESS;

  if (!htlcAddress || !usdcAddress) {
    throw new Error(
      "HTLC_ETH_ADDRESS and USDC_ETH_ADDRESS must be set in .env"
    );
  }

  console.log(`🔗 HTLC Contract: ${htlcAddress}`);
  console.log(`💰 USDC Contract: ${usdcAddress}`);

  // Load contract artifact
  console.log("📦 Loading contract artifact...");
  const artifactPath = path.join(
    __dirname,
    "artifacts/contracts/ShadeAgentSolver.sol/ShadeAgentSolver.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. Please compile the contract first."
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi, bytecode } = artifact;

  // Deploy contract
  console.log("⏳ Deploying Shade Agent Solver contract...");
  const ShadeAgentSolverFactory = new ethers.ContractFactory(
    abi,
    bytecode,
    wallet
  );

  const shadeAgentSolver = await ShadeAgentSolverFactory.deploy(
    htlcAddress,
    usdcAddress
  );

  console.log("⏳ Waiting for deployment confirmation...");
  await shadeAgentSolver.waitForDeployment();

  const contractAddress = await shadeAgentSolver.getAddress();
  console.log(`✅ Shade Agent Solver deployed to: ${contractAddress}`);

  // Verify deployment
  console.log("🔍 Verifying deployment...");
  const deployedContract = new ethers.Contract(contractAddress, abi, wallet);

  const htlcContract = await deployedContract.htlcContract();
  const usdcToken = await deployedContract.usdcToken();

  console.log(`✅ HTLC Contract verified: ${htlcContract}`);
  console.log(`✅ USDC Token verified: ${usdcToken}`);

  // Save deployment info
  const deploymentInfo = {
    network: (await provider.getNetwork()).name,
    shadeAgentSolverAddress: contractAddress,
    htlcContractAddress: htlcAddress,
    usdcTokenAddress: usdcAddress,
    deployer: wallet.address,
    blockNumber: await provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const deploymentPath = path.join(__dirname, "deployment-info.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${deploymentPath}`);

  console.log("\n💾 Add the following to your .env file:");
  console.log(`\n# Shade Agent Solver Contract`);
  console.log(`SHADE_AGENT_SOLVER_ETH_ADDRESS=${contractAddress}`);

  return deploymentInfo;
}

// Run deployment
deployShadeAgentSolver()
  .then((deploymentInfo) => {
    console.log("\n🎉 Shade Agent Solver deployment completed successfully!");
    console.log(`Contract Address: ${deploymentInfo.shadeAgentSolverAddress}`);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
