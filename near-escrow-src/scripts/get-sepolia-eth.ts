import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const TARGET_ADDRESS = "0x617206eb31554a759eDec3d644b88C6892a0343D";
const REQUIRED_AMOUNT = "23648936850"; // wei needed for transaction

async function getSepETH() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  
  console.log("🔍 Checking current balance...");
  const balance = await provider.getBalance(TARGET_ADDRESS);
  console.log(`Current balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`Required: ${ethers.formatEther(REQUIRED_AMOUNT)} ETH`);
  
  if (balance >= BigInt(REQUIRED_AMOUNT)) {
    console.log("✅ Account has sufficient balance!");
    return;
  }
  
  console.log("\n💰 Need to add Sepolia ETH to the account...");
  console.log(`Account address: ${TARGET_ADDRESS}`);
  
  // Method 1: Try programmatic faucet requests
  console.log("\n🚰 Attempting to request from faucets...");
  
  try {
    // Alchemy faucet API (if available)
    const faucetResponse = await fetch('https://sepoliafaucet.com/api/faucet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: TARGET_ADDRESS,
        amount: '0.1'
      })
    });
    
    if (faucetResponse.ok) {
      const result = await faucetResponse.json();
      console.log("✅ Faucet request successful:", result);
      
      // Wait for transaction to confirm
      console.log("⏳ Waiting for transaction to confirm...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      const newBalance = await provider.getBalance(TARGET_ADDRESS);
      console.log(`New balance: ${ethers.formatEther(newBalance)} ETH`);
      
      if (newBalance >= BigInt(REQUIRED_AMOUNT)) {
        console.log("✅ Account now has sufficient balance!");
        return;
      }
    }
  } catch (error: any) {
    console.log("❌ Programmatic faucet request failed:", error.message);
  }
  
  // Method 2: Manual faucet instructions
  console.log("\n📋 Manual faucet options:");
  console.log("1. Alchemy Sepolia Faucet: https://sepoliafaucet.com/");
  console.log("2. Chainlink Faucet: https://faucets.chain.link/sepolia");
  console.log("3. QuickNode Faucet: https://faucet.quicknode.com/ethereum/sepolia");
  console.log("4. Infura Faucet: https://www.infura.io/faucet/sepolia");
  
  console.log(`\n🔑 Address to fund: ${TARGET_ADDRESS}`);
  console.log("💡 Request at least 0.01 ETH (much more than needed)");
  
  // Method 3: Check if we can use a local hardhat network instead
  console.log("\n🔧 Alternative: Use local Hardhat network");
  console.log("1. Start local hardhat node: npx hardhat node");
  console.log("2. Update ETH_RPC in .env to: http://localhost:8545");
  console.log("3. Use hardhat's default funded accounts");
  
  // Wait and check again
  console.log("\n⏳ Waiting 60 seconds then checking balance again...");
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  const finalBalance = await provider.getBalance(TARGET_ADDRESS);
  console.log(`Final balance: ${ethers.formatEther(finalBalance)} ETH`);
  
  if (finalBalance >= BigInt(REQUIRED_AMOUNT)) {
    console.log("✅ Account now has sufficient balance!");
  } else {
    console.log("❌ Still need more ETH. Please use one of the faucets above.");
  }
}

getSepETH().catch(console.error);
