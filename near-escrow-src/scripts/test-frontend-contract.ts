import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function testFrontendContract() {
  console.log("🧪 Testing frontend contract call...\n");

  try {
    // Use the same USDC contract address as the frontend
    const usdcAddress = "0x04C89607413713Ec9775E14b954286519d836FEf";

    // Use the same ABI as the frontend
    const USDC_ABI = [
      "function balanceOf(address owner) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
    ];

    // Create provider (like frontend does)
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // Create contract instance (like frontend does)
    const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, provider);

    // Test account
    const account = "0x62482a678d5F8D6D789654040E6BB8077215CCa8";

    console.log(`🔍 Testing with account: ${account}`);
    console.log(`🏦 USDC Contract: ${usdcAddress}`);

    // Get network info
    const network = await provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Try the balanceOf call exactly like frontend
    console.log("📞 Calling balanceOf...");
    const balance = await usdcContract.balanceOf(account);
    const formattedBalance = ethers.formatUnits(balance, 6);

    console.log(`💰 Raw balance: ${balance.toString()}`);
    console.log(`💰 Formatted balance: ${formattedBalance} USDC`);

    console.log("✅ Frontend-style contract call successful!");
  } catch (error) {
    console.error("❌ Error in frontend-style contract call:", error);
  }
}

// Run the test
testFrontendContract().catch(console.error);
