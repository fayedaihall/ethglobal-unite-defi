import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function checkSepoliaContract() {
  console.log("🔍 Checking Sepolia contract and balance...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // USDC contract address on Sepolia
    const usdcAddress = "0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43";

    // Test account
    const account = "0x62482a678d5F8D6D789654040E6BB8077215CCa8";

    console.log(`🔍 Checking contract at: ${usdcAddress}`);
    console.log(`🔍 Testing account: ${account}`);

    // Get network info
    const network = await provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Check if contract exists
    const code = await provider.getCode(usdcAddress);
    console.log(`📏 Contract code length: ${code.length} characters`);

    if (code === "0x") {
      console.log("❌ Contract does not exist at this address on Sepolia!");
      return;
    }

    console.log("✅ Contract exists on Sepolia");

    // Create contract instance
    const usdcAbi = [
      "function balanceOf(address owner) external view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    // Try the balanceOf call
    console.log("📞 Calling balanceOf...");
    const balance = await usdcContract.balanceOf(account);
    const formattedBalance = ethers.formatUnits(balance, 6);

    console.log(`💰 Raw balance: ${balance.toString()}`);
    console.log(`💰 Formatted balance: ${formattedBalance} USDC`);

    console.log("✅ Balance check successful on Sepolia!");
  } catch (error) {
    console.error("❌ Error checking Sepolia contract:", error);
  }
}

// Run the check
checkSepoliaContract().catch(console.error);
