import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function approveUsdc() {
  console.log("✅ Approving USDC for betting...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);

    // Contract addresses
    const usdcAddress = "0x51A1ceB83B83F1985a81C295d1fF28Afef186E02";
    const betSwapAIAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    const usdcAbi = [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)",
      "function balanceOf(address owner) external view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // User account
    const userAccount = "0x62482a678d5F8D6D789654040E6BB8077215CCa8";
    const approvalAmount = ethers.parseUnits("1000000", 6); // 1 million USDC

    console.log(
      `📤 Approving ${ethers.formatUnits(
        approvalAmount,
        6
      )} USDC for BetSwap AI contract...`
    );

    const approveTx = await usdcContract.approve(
      betSwapAIAddress,
      approvalAmount
    );
    await approveTx.wait();

    console.log("✅ USDC approved successfully!");

    // Check allowance
    const allowance = await usdcContract.allowance(
      userAccount,
      betSwapAIAddress
    );
    console.log(`💰 Allowance: ${ethers.formatUnits(allowance, 6)} USDC\n`);
  } catch (error) {
    console.error("❌ Error approving USDC:", error);
  }
}

// Run the approval script
approveUsdc().catch(console.error);
