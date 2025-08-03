import { ethers } from "ethers";

const originalSecret =
  "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";
const originalSecretBuffer = Buffer.from(originalSecret, "hex");
const targetHashlock = ethers.sha256(originalSecretBuffer);

console.log("Original secret:", originalSecret);
console.log("Target hashlock (SHA256 of original):", targetHashlock);
console.log("Ethereum HTLC expects: keccak256(secret) =", targetHashlock);

// We need to find a secret where keccak256(secret) = targetHashlock
// This is computationally expensive, but let's try a few approaches

console.log("\nAttempting to find a secret that satisfies:");
console.log("keccak256(secret) =", targetHashlock);

// Let's try the original secret first to confirm it doesn't work
const keccakOfOriginal = ethers.keccak256(originalSecretBuffer);
console.log("keccak256(original_secret) =", keccakOfOriginal);
console.log("Matches?", keccakOfOriginal === targetHashlock);

// This is a very difficult problem - finding a preimage for a specific hash
// In practice, this would require a massive computational effort
console.log(
  "\nNote: Finding such a secret would require solving a cryptographic preimage problem"
);
console.log("This is computationally infeasible with current technology");
console.log("The solution is to either:");
console.log("1. Redeploy the HTLC contract to use SHA256");
console.log(
  "2. Fix the 02-resolver-fill.ts script to use Keccak256 when creating the hashlock"
);
console.log("3. Use a different approach for the atomic swap");
