import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function fundUsdc() {
  console.log("💰 Funding user with USDC tokens...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);

    // USDC contract address (from deployment)
    const usdcAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
    const usdcAbi = [
      "function mint(address to, uint256 amount) external",
      "function balanceOf(address owner) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // Fund the user account
    const userAccount = "0x62482a678d5F8D6D789654040E6BB8077215CCa8";
    const amount = ethers.parseUnits("1000000", 6); // 1 million USDC (6 decimals)

    console.log(
      `📤 Minting ${ethers.formatUnits(amount, 6)} USDC to ${userAccount}...`
    );

    const mintTx = await usdcContract.mint(userAccount, amount);
    await mintTx.wait();

    console.log("✅ User funded with USDC successfully!");

    // Check balance
    const balance = await usdcContract.balanceOf(userAccount);
    console.log(`💰 USDC balance: ${ethers.formatUnits(balance, 6)} USDC\n`);
  } catch (error) {
    console.error("❌ Error funding USDC:", error);
  }
}

// Run the funding script
fundUsdc().catch(console.error);
