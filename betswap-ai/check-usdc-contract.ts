import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.sepolia" });

async function checkUsdcContract() {
  console.log("🔍 Checking USDC contract on Sepolia...");

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const address = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

  try {
    console.log(`📋 Contract address: ${address}`);
    console.log(`🌐 RPC URL: ${process.env.ETH_RPC}`);

    const code = await provider.getCode(address);
    console.log(`📦 Contract code length: ${code.length}`);

    if (code === "0x") {
      console.log("❌ Contract does not exist at this address");
    } else {
      console.log("✅ Contract exists at this address");

      // Try to call balanceOf to test the contract
      const usdcAbi = [
        "function balanceOf(address owner) external view returns (uint256)",
      ];
      const contract = new ethers.Contract(address, usdcAbi, provider);

      try {
        const testAddress = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";
        const balance = await contract.balanceOf(testAddress);
        console.log(
          `✅ Contract is callable. Balance for ${testAddress}: ${balance.toString()}`
        );
      } catch (callError) {
        console.log(
          `❌ Contract exists but is not callable: ${
            (callError as Error).message
          }`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error checking contract:", (error as Error).message);
  }
}

checkUsdcContract().catch(console.error);
