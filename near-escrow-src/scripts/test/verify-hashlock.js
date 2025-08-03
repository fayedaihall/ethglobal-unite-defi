import { ethers } from "ethers";

// The hashlock from the escrow status output
const hashlockBytes = [
  85, 173, 42, 122, 97, 231, 223, 28, 58, 102, 143, 81, 57, 185, 93, 97, 219,
  255, 15, 86, 49, 142, 162, 95, 82, 24, 49, 157, 147, 80, 159, 31,
];

const secret =
  "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";
const secretBuffer = Buffer.from(secret, "hex");

console.log("Hashlock from escrow (bytes):", hashlockBytes);
console.log(
  "Hashlock from escrow (hex):",
  "0x" + Buffer.from(hashlockBytes).toString("hex")
);
console.log(
  "Expected hashlock (SHA256 of secret):",
  ethers.sha256(secretBuffer)
);

console.log("\nVerification:");
console.log(
  "Do they match?",
  "0x" + Buffer.from(hashlockBytes).toString("hex") ===
    ethers.sha256(secretBuffer)
);

// Let's also check what the NEAR contract would compute
console.log("\nNEAR contract computation:");
console.log("1. Preimage (hex string):", secret);
console.log("2. Preimage as bytes:", Array.from(secretBuffer));
console.log("3. SHA256 of bytes:", ethers.sha256(secretBuffer));
console.log(
  "4. Stored hashlock:",
  "0x" + Buffer.from(hashlockBytes).toString("hex")
);
console.log(
  "5. Match?",
  ethers.sha256(secretBuffer) ===
    "0x" + Buffer.from(hashlockBytes).toString("hex")
);
