import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function checkBalance() {
  console.log("💰 Checking USDC balance...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // USDC contract address
    const usdcAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
    const targetAddress = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";

    // USDC ABI (minimal for balanceOf)
    const usdcAbi = [
      "function balanceOf(address owner) external view returns (uint256)",
      "function name() external view returns (string)",
      "function symbol() external view returns (string)",
      "function decimals() external view returns (uint8)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    console.log(`🔍 Checking balance for: ${targetAddress}`);
    console.log(`🏦 USDC Contract: ${usdcAddress}`);

    // Check contract info
    try {
      const name = await usdcContract.name();
      const symbol = await usdcContract.symbol();
      const decimals = await usdcContract.decimals();

      console.log(`📋 Contract Info:`);
      console.log(`   Name: ${name}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);
    } catch (error) {
      console.log(
        "⚠️ Could not get contract info, but will try to check balance..."
      );
    }

    // Check balance
    try {
      const balance = await usdcContract.balanceOf(targetAddress);
      const balanceFormatted = ethers.formatUnits(balance, 6);

      console.log(`\n💰 Balance Check:`);
      console.log(`   Address: ${targetAddress}`);
      console.log(`   USDC Balance: ${balanceFormatted} USDC`);
      console.log(`   Raw Balance: ${balance.toString()}`);
    } catch (error) {
      console.error("❌ Error checking balance:", error);

      // Try alternative approach
      console.log("\n🔄 Trying alternative balance check...");
      try {
        const data = usdcContract.interface.encodeFunctionData("balanceOf", [
          targetAddress,
        ]);
        const result = await provider.call({
          to: usdcAddress,
          data: data,
        });

        if (result === "0x") {
          console.log("   Balance: 0 USDC (or contract not responding)");
        } else {
          const decoded = usdcContract.interface.decodeFunctionResult(
            "balanceOf",
            result
          );
          const balance = decoded[0];
          const balanceFormatted = ethers.formatUnits(balance, 6);
          console.log(`   USDC Balance: ${balanceFormatted} USDC`);
        }
      } catch (altError) {
        console.error("❌ Alternative check also failed:", altError);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the balance check
checkBalance().catch(console.error);
