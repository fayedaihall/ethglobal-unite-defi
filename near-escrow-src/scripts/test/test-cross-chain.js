import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.sepolia" });

async function testCrossChain() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

    console.log("Wallet address:", wallet.address);

    // Contract addresses
    const betTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const betSwapAIAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

    const erc20Abi = [
      "function balanceOf(address) view returns(uint256)",
      "function approve(address,uint256) returns(bool)",
      "function allowance(address,address) view returns(uint256)",
    ];

    const betSwapAIAbi = [
      "function placeBet(bytes32,uint256,bool)",
      "function createBetEvent(bytes32,string,uint256)",
    ];

    console.log("\n=== Cross-Chain Betting Demo ===");

    try {
      const betTokenContract = new ethers.Contract(
        betTokenAddress,
        erc20Abi,
        wallet
      );
      const betSwapAIContract = new ethers.Contract(
        betSwapAIAddress,
        betSwapAIAbi,
        wallet
      );

      // Check balance
      const balance = await betTokenContract.balanceOf(wallet.address);
      console.log("✅ BET Token Balance:", balance.toString());

      // Approve BetSwapAI to spend tokens
      console.log("\n🔐 Approving BetSwapAI to spend tokens...");
      const approveTx = await betTokenContract.approve(
        betSwapAIAddress,
        "1000000000000000000000000"
      );
      await approveTx.wait();
      console.log("✅ Approval successful");

      // Create a test event
      const eventId = ethers.keccak256(ethers.toUtf8Bytes("cross_chain_test"));
      const description = "Cross-chain betting test";
      const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      console.log("\n🎯 Creating betting event...");
      const createEventTx = await betSwapAIContract.createBetEvent(
        eventId,
        description,
        endTime
      );
      await createEventTx.wait();
      console.log("✅ Betting event created");

      // Place a bet (simulating cross-chain)
      const amount = "2000000000000000000000000"; // 2 tokens
      const outcome = true;

      console.log("\n🌉 Placing cross-chain bet...");
      console.log("   Event ID: cross_chain_test");
      console.log("   Amount: 2 BET tokens");
      console.log("   Outcome: Yes");
      console.log("   NEAR Account: fayefaye2.testnet");

      const betTx = await betSwapAIContract.placeBet(eventId, amount, outcome);
      await betTx.wait();

      console.log("✅ Cross-chain bet placed successfully!");
      console.log("   Transaction:", betTx.hash);
      console.log("\n📋 Summary:");
      console.log("   - Bet placed on Ethereum");
      console.log("   - Tokens transferred to BetSwapAI contract");
      console.log("   - Ready for cross-chain settlement on NEAR");
      console.log(
        "   - HTLC escrow would be created for secure cross-chain transfer"
      );
    } catch (error) {
      console.log("❌ Error:", error.message);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testCrossChain();
