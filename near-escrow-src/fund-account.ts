import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function fundAccount() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  
  // Address that needs funding
  const targetAddress = "0x617206eb31554a759eDec3d644b88C6892a0343D";
  
  // Amount to send (0.1 ETH should be plenty for testing)
  const amount = ethers.parseEther("0.1");
  
  console.log(`Target address: ${targetAddress}`);
  console.log(`Amount to send: ${ethers.formatEther(amount)} ETH`);
  
  // Check current balance
  const currentBalance = await provider.getBalance(targetAddress);
  console.log(`Current balance: ${ethers.formatEther(currentBalance)} ETH`);
  
  // If you have a funded account, uncomment and use this:
  /*
  const FUNDED_PRIVATE_KEY = "your_funded_account_private_key_here";
  const wallet = new ethers.Wallet(FUNDED_PRIVATE_KEY, provider);
  
  console.log(`Sending from: ${wallet.address}`);
  
  const tx = await wallet.sendTransaction({
    to: targetAddress,
    value: amount
  });
  
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log("Transaction confirmed!");
  
  const newBalance = await provider.getBalance(targetAddress);
  console.log(`New balance: ${ethers.formatEther(newBalance)} ETH`);
  */
  
  console.log("\n=== Instructions ===");
  console.log("1. Visit https://sepoliafaucet.com/");
  console.log(`2. Enter address: ${targetAddress}`);
  console.log("3. Request 0.1 ETH (much more than needed)");
  console.log("4. Wait for the transaction to confirm");
  console.log("5. Run this script again to verify the balance");
}

fundAccount().catch(console.error);
