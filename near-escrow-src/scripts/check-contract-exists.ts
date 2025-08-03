import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function checkContractExists() {
  console.log("🔍 Checking if USDC contract exists...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

    // USDC contract address
    const usdcAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

    console.log(`🔍 Checking contract at: ${usdcAddress}`);

    // Check if contract exists by getting its code
    const code = await provider.getCode(usdcAddress);

    if (code === "0x") {
      console.log("❌ Contract does not exist at this address");
      return;
    }

    console.log("✅ Contract exists at this address");
    console.log(`📏 Contract code length: ${code.length} characters`);

    // Try to create a contract instance and call a simple function
    const usdcAbi = [
      "function balanceOf(address owner) external view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

    // Test with a random address
    const testAccount = "0x0000000000000000000000000000000000000000";
    console.log(`🧪 Testing balanceOf with address: ${testAccount}`);

    try {
      const balance = await usdcContract.balanceOf(testAccount);
      console.log(
        `✅ balanceOf function works, returned: ${balance.toString()}`
      );
    } catch (error) {
      console.log("❌ balanceOf function failed:", error);
    }
  } catch (error) {
    console.error("❌ Error checking contract:", error);
  }
}

// Run the check
checkContractExists().catch(console.error);
