import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function debugContract() {
  console.log("🔍 Debugging BetSwapAI Contract Execution...\n");

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);

  console.log("📋 Environment Info:");
  console.log(`   Wallet Address: ${wallet.address}`);
  console.log(`   BET Token: ${process.env.BET_TOKEN_ETH_ADDRESS}`);
  console.log(`   BetSwapAI: ${process.env.BETSWAP_AI_ETH_ADDRESS}`);
  console.log(`   HTLC: ${process.env.HTLC_ETH_ADDRESS}\n`);

  // Create contract instances
  const betToken = new ethers.Contract(
    process.env.BET_TOKEN_ETH_ADDRESS!,
    [
      "function balanceOf(address) view returns(uint256)",
      "function allowance(address,address) view returns(uint256)",
      "function owner() view returns(address)",
      "function totalSupply() view returns(uint256)",
    ],
    provider
  );

  const betSwapAI = new ethers.Contract(
    process.env.BETSWAP_AI_ETH_ADDRESS!,
    [
      "function getBetEventInfo(bytes32) view returns(string,uint256,bool,bool,uint256)",
      "function betToken() view returns(address)",
      "function htlcContract() view returns(address)",
      "function placeCrossChainBet(bytes32,uint256,bool,string) returns(bytes32)",
    ],
    provider
  );

  try {
    // 1. Check BET token balance
    console.log("💰 Checking BET token balance...");
    const balance = await betToken.balanceOf(wallet.address);
    console.log(`   Balance: ${balance.toString()} BET tokens`);
    console.log(`   Required: 2000000 BET tokens`);
    console.log(`   Sufficient: ${BigInt(balance) >= BigInt("2000000")}\n`);

    // 2. Check BET token owner
    console.log("👤 Checking BET token owner...");
    const owner = await betToken.owner();
    console.log(`   Owner: ${owner}`);
    console.log(`   Is wallet owner: ${owner.toLowerCase() === wallet.address.toLowerCase()}\n`);

    // 3. Check total supply
    console.log("📊 Checking BET token total supply...");
    const totalSupply = await betToken.totalSupply();
    console.log(`   Total Supply: ${totalSupply.toString()}\n`);

    // 4. Check allowance
    console.log("🔐 Checking token allowance...");
    const allowance = await betToken.allowance(wallet.address, process.env.BETSWAP_AI_ETH_ADDRESS!);
    console.log(`   Current Allowance: ${allowance.toString()}`);
    console.log(`   Required: 2000000`);
    console.log(`   Sufficient: ${BigInt(allowance) >= BigInt("2000000")}\n`);

    // 5. Check event existence
    console.log("🎯 Checking betting event...");
    const eventId = "ethereum_10000_dec_2025";
    const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(eventId));
    const eventInfo = await betSwapAI.getBetEventInfo(eventIdBytes);
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Description: ${eventInfo[0]}`);
    console.log(`   End Time: ${new Date(Number(eventInfo[1]) * 1000).toISOString()}`);
    console.log(`   Resolved: ${eventInfo[2]}`);
    console.log(`   Outcome: ${eventInfo[3]}`);
    console.log(`   Total Bets: ${eventInfo[4].toString()}`);
    console.log(`   Event Exists: ${eventInfo[1] > 0}\n`);

    // 6. Check contract addresses match
    console.log("🔗 Checking contract references...");
    const betTokenInContract = await betSwapAI.betToken();
    const htlcInContract = await betSwapAI.htlcContract();
    console.log(`   BET Token in contract: ${betTokenInContract}`);
    console.log(`   Expected BET Token: ${process.env.BET_TOKEN_ETH_ADDRESS}`);
    console.log(`   Match: ${betTokenInContract.toLowerCase() === process.env.BET_TOKEN_ETH_ADDRESS!.toLowerCase()}`);
    console.log(`   HTLC in contract: ${htlcInContract}`);
    console.log(`   Expected HTLC: ${process.env.HTLC_ETH_ADDRESS}`);
    console.log(`   Match: ${htlcInContract.toLowerCase() === process.env.HTLC_ETH_ADDRESS!.toLowerCase()}\n`);

    // 7. Check network and nonce
    console.log("🌐 Checking network info...");
    const network = await provider.getNetwork();
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Current Nonce: ${nonce}\n`);

    // 8. Try to simulate the transaction
    console.log("🧪 Simulating transaction...");
    try {
      const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes("ethereum_10000_dec_2025"));
      const gasEstimate = await provider.estimateGas({
        to: betSwapAI.address,
        data: betSwapAI.interface.encodeFunctionData("placeCrossChainBet", [
          eventIdBytes,
          "2000000",
          true,
          "fayefaye2.testnet",
        ]),
        from: wallet.address,
      });
      console.log(`   Gas Estimate: ${gasEstimate.toString()}`);
    } catch (error: any) {
      console.log(`   ❌ Gas Estimation Failed: ${error.message}`);
      
      // Try to decode the error
      if (error.data) {
        console.log(`   Error Data: ${error.data}`);
      }
    }

  } catch (error: any) {
    console.error("❌ Debug Error:", error.message);
  }
}

debugContract().catch(console.error);
