import { ethers } from "ethers";

const secret =
  "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";
const secretBuffer = Buffer.from(secret, "hex");

console.log("Secret (hex string):", secret);
console.log("Secret (as bytes):", Array.from(secretBuffer));
console.log("SHA256 of secret bytes:", ethers.sha256(secretBuffer));
console.log(
  "Expected hashlock from NEAR:",
  "0x55ad2a7a61e7df1c3a668f5139b95d61dbff0f56318ea25f5218319d93509f1f"
);

// The NEAR contract expects:
// 1. preimage as a String (hex string)
// 2. converts it to bytes with preimage.as_bytes()
// 3. hashes with env::sha256()
// 4. compares with stored hashlock

console.log("\nNEAR contract verification:");
console.log("1. Preimage (hex string):", secret);
console.log("2. Preimage as bytes:", Array.from(secretBuffer));
console.log("3. SHA256 of bytes:", ethers.sha256(secretBuffer));
console.log(
  "4. Matches hashlock?",
  ethers.sha256(secretBuffer) ===
    "0x55ad2a7a61e7df1c3a668f5139b95d61dbff0f56318ea25f5218319d93509f1f"
);

// The issue might be that we need to pass the secret as a hex string
// but the contract might be expecting it in a different format
