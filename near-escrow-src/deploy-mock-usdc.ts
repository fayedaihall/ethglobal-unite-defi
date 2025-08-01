import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();
// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function deployMockUSDC() {
  // Validate environment variables
  if (!process.env.ETH_RPC) {
    throw new Error("ETH_RPC is not set in .env");
  }
  if (!process.env.ETH_PRIVATE_KEY) {
    throw new Error("ETH_PRIVATE_KEY is not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const privateKey = process.env.ETH_PRIVATE_KEY.startsWith("0x")
    ? process.env.ETH_PRIVATE_KEY
    : `0x${process.env.ETH_PRIVATE_KEY}`;
  const wallet = new ethers.Wallet(privateKey, provider);

  // Option 1: Use Hardhat artifacts (if available)
  try {
    // Try to read from Hardhat artifacts
    const artifactsPath = "./artifacts/contracts/MockUSDC.sol/MockUSDC.json";
    const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
    const bytecode = artifacts.bytecode;
    const abi = artifacts.abi;

    console.log("Using Hardhat artifacts for deployment...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log("MockUSDC deployed on Ethereum at:", contractAddress);
    console.log("Deployment tx:", contract.deploymentTransaction()?.hash);

    return contractAddress;
  } catch (error) {
    console.error(
      "Hardhat artifacts not found or deployment failed:",
      error.message
    );
    throw error;
  }
}

// Run the deployment
deployMockUSDC().catch(console.error);
