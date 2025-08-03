import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.sepolia" });

async function testBalance() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

    console.log("Wallet address:", wallet.address);

    // Test the new BetToken contract
    const betTokenAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";

    const erc20Abi = [
      "function balanceOf(address) view returns(uint256)",
      "function totalSupply() view returns(uint256)",
      "function name() view returns(string)",
      "function symbol() view returns(string)",
      "function decimals() view returns(uint8)",
      "function transferFrom(address,address,uint256) returns(bool)",
      "function approve(address,uint256) returns(bool)",
      "function allowance(address,address) view returns(uint256)",
    ];

    console.log(`\nTesting NEW BetToken at: ${betTokenAddress}`);

    try {
      const betTokenContract = new ethers.Contract(
        betTokenAddress,
        erc20Abi,
        wallet
      );

      // Test basic ERC20 functions
      const balance = await betTokenContract.balanceOf(wallet.address);
      console.log("✅ Balance:", balance.toString());

      const totalSupply = await betTokenContract.totalSupply();
      console.log("✅ Total Supply:", totalSupply.toString());

      const name = await betTokenContract.name();
      console.log("✅ Name:", name);

      const symbol = await betTokenContract.symbol();
      console.log("✅ Symbol:", symbol);

      const decimals = await betTokenContract.decimals();
      console.log("✅ Decimals:", decimals);

      // Test approval for the new BetSwapAI contract
      const betSwapAIAddress = "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
      console.log(`\nTesting approval for NEW BetSwapAI: ${betSwapAIAddress}`);

      const approveTx = await betTokenContract.approve(
        betSwapAIAddress,
        "1000000000000000000000000"
      );
      await approveTx.wait();
      console.log("✅ Approval successful");

      const allowance = await betTokenContract.allowance(
        wallet.address,
        betSwapAIAddress
      );
      console.log("✅ Allowance:", allowance.toString());
    } catch (error) {
      console.log("❌ Error:", error.message);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testBalance();
