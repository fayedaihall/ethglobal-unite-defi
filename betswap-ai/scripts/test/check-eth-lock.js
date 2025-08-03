import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();
// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function checkLock(escrowId) {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const htlcAbi = [
    "function locks(bytes32) view returns (address, address, address, uint256, bytes32, uint256, bool)",
  ];
  const htlc = new ethers.Contract(
    process.env.HTLC_ETH_ADDRESS,
    htlcAbi,
    provider
  );
  const lockId = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));

  console.log(`Checking Ethereum lock for escrow ID ${escrowId}`);
  console.log(`Lock ID: ${lockId}`);

  try {
    const lock = await htlc.locks(lockId);
    console.log("Lock:", {
      sender: lock[0],
      recipient: lock[1],
      token: lock[2],
      amount: lock[3].toString(),
      hashlock: lock[4],
      timelock: lock[5].toString(),
      withdrawn: lock[6],
    });
  } catch (error) {
    console.error("Error querying lock:", error.message);
    console.log(
      "This might mean the lock doesn't exist or the contract is not deployed."
    );
  }
}

// Get command line arguments
const escrowId = Number(process.argv[2]);

if (!escrowId || isNaN(escrowId)) {
  console.error("Usage: ts-node check-eth-lock.js <escrowId>");
  console.error("Example: ts-node check-eth-lock.js 26");
  process.exit(1);
}

checkLock(escrowId).catch(console.error);
