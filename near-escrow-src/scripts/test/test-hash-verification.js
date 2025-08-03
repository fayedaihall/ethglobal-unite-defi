import { ethers } from "ethers";

const secret =
  "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";
const secretBuffer = Buffer.from(secret, "hex");

console.log("Secret:", secret);
console.log("SHA256:", ethers.sha256(secretBuffer));
console.log("Keccak256:", ethers.keccak256(secretBuffer));
console.log(
  "Expected hashlock for Ethereum (SHA256):",
  ethers.sha256(secretBuffer)
);
console.log(
  "What HTLC contract expects (Keccak256):",
  ethers.keccak256(secretBuffer)
);

// The issue is:
// 1. Ethereum lock was created with hashlock = SHA256(secret) = 0x55ad2a7a61e7df1c3a668f5139b95d61dbff0f56318ea25f5218319d93509f1f
// 2. But HTLC contract's withdraw function checks: keccak256(preimage) == hashlock
// 3. So it expects: keccak256(secret) == hashlock
// 4. But keccak256(secret) = 0xb276630c6d3f58f30d261e47da93817317815e3c468f1eeedaa485b9293ca716
// 5. This doesn't match the hashlock 0x55ad2a7a61e7df1c3a668f5139b95d61dbff0f56318ea25f5218319d93509f1f

console.log("\nProblem identified:");
console.log("HTLC contract expects keccak256(preimage) to match the hashlock");
console.log("But the hashlock was created using SHA256, not Keccak256");
console.log(
  "This is a mismatch in hashing algorithms between creation and verification"
);
