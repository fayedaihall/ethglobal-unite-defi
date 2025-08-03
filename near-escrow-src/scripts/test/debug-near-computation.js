import { ethers } from "ethers";

const secret =
  "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";
const secretBuffer = Buffer.from(secret, "hex");

console.log("Debug NEAR contract computation:");
console.log("1. Preimage (String):", secret);
console.log("2. Preimage.as_bytes():", Array.from(secretBuffer));
console.log(
  "3. env::sha256(preimage.as_bytes()):",
  ethers.sha256(secretBuffer)
);
console.log(
  "4. Stored hashlock (from escrow):",
  "0x55ad2a7a61e7df1c3a668f5139b95d61dbff0f56318ea25f5218319d93509f1f"
);

// Let's also check what the original hashlock was when created
console.log("\nOriginal hashlock creation (from 01-user-create-lock.ts):");
console.log(
  "ethers.sha256(secret).slice(2):",
  ethers.sha256(secretBuffer).slice(2)
);
console.log("This should match the hashlock stored in the escrow");

// The issue might be that the hashlock was stored as a hex string without 0x
// but the contract is comparing it as bytes
console.log("\nPossible issue:");
console.log(
  "When escrow was created, hashlock was stored as hex string without 0x"
);
console.log(
  "But when withdrawing, contract converts preimage to bytes and hashes"
);
console.log("The comparison might be failing due to format mismatch");
