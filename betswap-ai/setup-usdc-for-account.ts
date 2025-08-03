import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env.sepolia" });

const TARGET_ACCOUNT = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";
const USDC_AMOUNT = "1000000000"; // 1 billion USDC

async function setupUsdcForAccount() {
  console.log("🚀 Setting up USDC for account:", TARGET_ACCOUNT);
  console.log("💰 Target amount:", USDC_AMOUNT, "USDC");

  // Try different RPC endpoints
  const rpcEndpoints = [
    "https://1rpc.io/sepolia",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    "https://eth-sepolia.g.alchemy.com/v2/demo",
  ];

  let provider: ethers.Provider | null = null;

  for (const rpc of rpcEndpoints) {
    try {
      console.log(`🔗 Trying RPC: ${rpc}`);
      provider = new ethers.JsonRpcProvider(rpc);
      await provider.getNetwork();
      console.log(`✅ Connected to ${rpc}`);
      break;
    } catch (error) {
      console.log(`❌ Failed to connect to ${rpc}`);
      continue;
    }
  }

  if (!provider) {
    console.error("❌ Could not connect to any RPC endpoint");
    return;
  }

  try {
    // Check if we have a private key for deployment
    const privateKey = process.env.ETH_PRIVATE_KEY;
    if (!privateKey) {
      console.error("❌ ETH_PRIVATE_KEY not found in .env.sepolia");
      console.log("💡 Please add your private key to .env.sepolia");
      return;
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`🔑 Using wallet: ${wallet.address}`);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
      console.log("❌ Wallet has no ETH for deployment");
      console.log("💡 Please fund the wallet with Sepolia ETH using a faucet");
      return;
    }

    // Try to deploy USDC contract
    console.log("📦 Deploying USDC contract...");

    try {
      // Read Hardhat artifacts
      const artifactsPath = "./artifacts/contracts/MockUSDC.sol/MockUSDC.json";
      const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
      const bytecode = artifacts.bytecode;
      const abi = artifacts.abi;

      const factory = new ethers.ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy();
      await contract.waitForDeployment();

      const contractAddress = await contract.getAddress();
      console.log("✅ USDC contract deployed at:", contractAddress);

      // Mint USDC to target account
      console.log(`🪙 Minting ${USDC_AMOUNT} USDC to ${TARGET_ACCOUNT}...`);
      const amountWei = ethers.parseUnits(USDC_AMOUNT, 6); // USDC has 6 decimals

      const mintTx = await contract.mint(TARGET_ACCOUNT, amountWei);
      await mintTx.wait();

      console.log("✅ USDC minted successfully!");

      // Verify the balance
      const usdcBalance = await contract.balanceOf(TARGET_ACCOUNT);
      console.log(
        `💰 ${TARGET_ACCOUNT} now has: ${ethers.formatUnits(
          usdcBalance,
          6
        )} USDC`
      );

      // Update all configuration files
      console.log("📝 Updating configuration files...");

      // Update frontend contract address
      const contractsPath = "./frontend/utils/contracts.ts";
      let contractsContent = fs.readFileSync(contractsPath, "utf8");
      contractsContent = contractsContent.replace(
        /"0x[a-fA-F0-9]{40}", \/\/ USDC address/,
        `"${contractAddress}", // USDC address`
      );
      fs.writeFileSync(contractsPath, contractsContent);

      // Update networks config
      const networksPath = "./frontend/config/networks.ts";
      let networksContent = fs.readFileSync(networksPath, "utf8");
      networksContent = networksContent.replace(
        /usdc: "0x[a-fA-F0-9]{40}"/,
        `usdc: "${contractAddress}"`
      );
      fs.writeFileSync(networksPath, networksContent);

      // Update .env.sepolia
      const envPath = ".env.sepolia";
      let envContent = fs.readFileSync(envPath, "utf8");
      envContent = envContent.replace(
        /USDC_ETH_ADDRESS=0x[a-fA-F0-9]{40}/,
        `USDC_ETH_ADDRESS=${contractAddress}`
      );
      fs.writeFileSync(envPath, envContent);

      // Update deployment file
      const deploymentPath = "./deployment-betswap-ai.json";
      let deploymentContent = fs.readFileSync(deploymentPath, "utf8");
      deploymentContent = deploymentContent.replace(
        /"usdc": "0x[a-fA-F0-9]{40}"/,
        `"usdc": "${contractAddress}"`
      );
      fs.writeFileSync(deploymentPath, deploymentContent);

      console.log("✅ All configuration files updated!");
      console.log(`🎉 Success! ${TARGET_ACCOUNT} now has 1,000,000,000 USDC`);
    } catch (error) {
      console.error(
        "❌ Error deploying/minting USDC:",
        (error as Error).message
      );
    }
  } catch (error) {
    console.error("❌ Error in setup:", (error as Error).message);
  }
}

setupUsdcForAccount().catch(console.error);
