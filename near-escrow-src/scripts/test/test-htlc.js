import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.sepolia" });

async function testHTLC() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

    console.log("Wallet address:", wallet.address);

    // Test the HTLC contract directly
    const htlcAddress = "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
    const betTokenAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";

    const htlcAbi = [
      "function createLock(bytes32,address,address,uint256,bytes32,uint256)",
      "function withdraw(bytes32,bytes)",
      "function refund(bytes32)",
      "function locks(bytes32) view returns(address,address,address,uint256,bytes32,uint256,bool)",
    ];

    const erc20Abi = [
      "function approve(address,uint256) returns(bool)",
      "function allowance(address,address) view returns(uint256)",
    ];

    console.log(`\nTesting HTLC createLock directly`);

    try {
      const htlcContract = new ethers.Contract(htlcAddress, htlcAbi, wallet);
      const betTokenContract = new ethers.Contract(
        betTokenAddress,
        erc20Abi,
        wallet
      );

      // First, approve the HTLC contract to spend tokens
      console.log("Approving HTLC contract to spend tokens...");
      const approveTx = await betTokenContract.approve(
        htlcAddress,
        "1000000000000000000000000"
      );
      await approveTx.wait();
      console.log("✅ HTLC approval successful");

      // Test createLock
      const escrowId = ethers.keccak256(ethers.toUtf8Bytes("test_escrow"));
      const recipient = wallet.address;
      const amount = "1000000000000000000000000"; // 1 token
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("test_secret"));
      const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      console.log("Creating HTLC lock...");
      const createLockTx = await htlcContract.createLock(
        escrowId,
        recipient,
        betTokenAddress,
        amount,
        hashlock,
        timelock
      );
      await createLockTx.wait();
      console.log("✅ HTLC createLock successful!");

      // Check the lock
      const lockInfo = await htlcContract.locks(escrowId);
      console.log("✅ Lock created:", lockInfo);
    } catch (error) {
      console.log("❌ HTLC Error:", error.message);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testHTLC();
