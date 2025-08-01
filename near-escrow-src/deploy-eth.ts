import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();
// Load environment variables from the appropriate file
const envFile = process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function deployEthHTLC() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
const privateKey = process.env.ETH_PRIVATE_KEY!.startsWith("0x") ? process.env.ETH_PRIVATE_KEY! : "0x" + process.env.ETH_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(privateKey, provider);

  // Option 1: Use Hardhat artifacts (if you have a contracts folder)
  try {
    // Try to read from Hardhat artifacts
    const artifactsPath = "./artifacts/contracts/HTLC.sol/HTLC.json";
    const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
    const bytecode = artifacts.bytecode;
    const abi = artifacts.abi;

    console.log("Using Hardhat artifacts for deployment...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    console.log("HTLC deployed on Ethereum at:", await contract.getAddress());
    console.log("Deployment tx:", contract.deploymentTransaction()?.hash);

    return;
  } catch (error) {
    console.log("Hardhat artifacts not found, using fallback method...");
  }
}

// Run the deployment
deployEthHTLC().catch(console.error);
