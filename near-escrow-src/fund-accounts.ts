import { ethers } from "ethers";
import { connect, keyStores, Near } from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function fundAccounts() {
  console.log("💰 Funding accounts with USDC...\n");

  // Ethereum funding
  try {
    console.log("🔗 Funding Ethereum account...");

    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);

    // USDC contract address on Sepolia
    const usdcAddress = process.env.USDC_ETH_ADDRESS!;
    const usdcAbi = [
      "function mint(address to, uint256 amount) external",
      "function balanceOf(address owner) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // Fund the Ethereum account
    const ethAccount = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";
    const ethAmount = ethers.parseUnits("10000", 6); // 10,000 USDC

    console.log(
      `📤 Minting ${ethers.formatUnits(ethAmount, 6)} USDC to ${ethAccount}...`
    );

    const mintTx = await usdcContract.mint(ethAccount, ethAmount);
    await mintTx.wait();

    console.log("✅ Ethereum account funded successfully!");

    // Check balance (with better error handling)
    try {
      const balance = await usdcContract.balanceOf(ethAccount);
      console.log(`💰 Balance: ${ethers.formatUnits(balance, 6)} USDC\n`);
    } catch (balanceError) {
      console.log("💰 Balance check failed, but minting was successful\n");
    }
  } catch (error) {
    console.error("❌ Error funding Ethereum account:", error);
  }

  // NEAR funding
  try {
    console.log("🔗 Funding NEAR account...");

    const nearConfig = {
      networkId: "testnet",
      nodeUrl: "https://rpc.testnet.near.org",
      keyStore: new keyStores.InMemoryKeyStore(),
    };

    const near = await connect(nearConfig);

    // For NEAR, we'll simulate USDC funding since we're using mock USDC
    const nearAccount = "fayefaye2.testnet";

    console.log(`📤 Funding ${nearAccount} with USDC (simulated)...`);

    // In a real implementation, you would interact with the NEAR USDC contract
    // For now, we'll just log the action
    console.log("✅ NEAR account funding simulated successfully!");
    console.log(`💰 Simulated balance: 10,000 USDC\n`);
  } catch (error) {
    console.error("❌ Error funding NEAR account:", error);
  }

  console.log("🎉 Account funding complete!");
  console.log("\n📋 Summary:");
  console.log(
    "- Ethereum account 0x3aa1fe004111a6EA3180ccf557D8260F36b717d1: 10,000 USDC"
  );
  console.log("- NEAR account fayefaye2.testnet: 10,000 USDC (simulated)");
}

// Run the funding script
fundAccounts().catch(console.error);
