import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function checkUsdcBalance() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

  // USDC contract address on Sepolia
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const targetAddress = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";

  const usdcAbi = [
    "function balanceOf(address owner) external view returns (uint256)",
  ];

  try {
    console.log("🔍 Checking USDC balance...");
    console.log(`📋 Account: ${targetAddress}`);
    console.log(`🏦 USDC Contract: ${usdcAddress}`);
    console.log(`🌐 Network: Sepolia Testnet\n`);

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    // Assume USDC has 6 decimals
    const decimals = 6;

    console.log(`📝 Token Info:`);
    console.log(`   Contract: ${usdcAddress}`);
    console.log(`   Decimals: ${decimals}\n`);

    // Get balance
    const balance = await usdcContract.balanceOf(targetAddress);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    console.log(`💰 Balance:`);
    console.log(`   Raw: ${balance.toString()}`);
    console.log(`   Formatted: ${formattedBalance} USDC`);

    if (balance > 0) {
      console.log(`\n✅ Account has USDC balance!`);
    } else {
      console.log(`\n❌ Account has no USDC balance.`);
    }

    // Also check ETH balance for gas
    const ethBalance = await provider.getBalance(targetAddress);
    console.log(`\n⛽ ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
  } catch (error) {
    console.error("❌ Error checking USDC balance:", error);
  }
}

checkUsdcBalance().catch(console.error);
