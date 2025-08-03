import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function fundSpecificAddress() {
  console.log("💰 Funding specific address with USDC tokens...\n");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);

    // USDC contract address (newly deployed)
    const usdcAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
    const usdcAbi = [
      "function mint(address to, uint256 amount) external",
      "function balanceOf(address owner) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);

    // Fund the specific address
    const targetAddress = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";
    const amount = ethers.parseUnits("100000000", 6); // 100 million USDC (6 decimals)

    console.log(
      `📤 Minting ${ethers.formatUnits(amount, 6)} USDC to ${targetAddress}...`
    );

    const mintTx = await usdcContract.mint(targetAddress, amount);
    await mintTx.wait();

    console.log("✅ Address funded with USDC successfully!");

    // Check balance
    const balance = await usdcContract.balanceOf(targetAddress);
    console.log(`💰 USDC balance: ${ethers.formatUnits(balance, 6)} USDC\n`);

    console.log(`Transaction hash: ${mintTx.hash}`);
    console.log(`Etherscan: https://sepolia.etherscan.io/tx/${mintTx.hash}`);
  } catch (error) {
    console.error("❌ Error funding USDC:", error);
  }
}

// Run the funding script
fundSpecificAddress().catch(console.error);
