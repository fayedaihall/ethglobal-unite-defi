import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.sepolia" });

async function checkAccountBalance() {
  console.log("🔍 Checking account balance on Sepolia...");

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const address = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";

  try {
    console.log(`📋 Account: ${address}`);
    console.log(`🌐 RPC URL: ${process.env.ETH_RPC}`);

    const balance = await provider.getBalance(address);
    console.log(`💰 ETH Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance > 0) {
      console.log("✅ Account has ETH balance for deployment");
    } else {
      console.log("❌ Account has no ETH balance - needs funding");
      console.log("\n💡 To fund this account, use a Sepolia faucet:");
      console.log("   - Alchemy: https://sepoliafaucet.com/");
      console.log("   - Chainlink: https://faucets.chain.link/sepolia");
      console.log(`   - Address to fund: ${address}`);
    }
  } catch (error) {
    console.error("❌ Error checking balance:", (error as Error).message);
  }
}

checkAccountBalance().catch(console.error);
