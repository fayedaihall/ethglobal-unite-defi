import crypto from "crypto";
import { ethers } from "ethers";

// The secret we're using
const secretHex =
  "0ade51cf8eb73e918acb59e3abbbd8077eb4f7ab53d7e27168a2fb944569e0fc";

console.log("Debug hash calculation:");
console.log("Secret (hex):", secretHex);

// Convert hex to buffer
const secretBuffer = Buffer.from(secretHex, "hex");
console.log("Secret (buffer):", secretBuffer);

// Calculate hash using crypto (like NEAR contract)
const hashCrypto = crypto.createHash("sha256").update(secretBuffer).digest();
console.log("Hash (crypto):", hashCrypto.toString("hex"));

// Calculate hash using ethers
const hashEthers = ethers.sha256(secretBuffer);
console.log("Hash (ethers):", hashEthers);

// Expected hashlock from escrow
const expectedHashlock =
  "a62142a6d91226da2df913a6f992bf6490019d57c9ed1a4687ed8d29f95f15e9";
console.log("Expected hashlock:", expectedHashlock);

// Check if they match
console.log(
  "Crypto hash matches expected:",
  hashCrypto.toString("hex") === expectedHashlock
);
console.log(
  "Ethers hash matches expected:",
  hashEthers.slice(2) === expectedHashlock
);

// Test what happens when we convert hex to string and back
const secretString = secretBuffer.toString("utf8");
console.log("Secret as string:", secretString);
console.log("Secret string length:", secretString.length);

// Convert string back to buffer
const secretStringBuffer = Buffer.from(secretString, "utf8");
console.log("Secret string as buffer:", secretStringBuffer);
console.log("Buffers match:", secretBuffer.equals(secretStringBuffer));

// Calculate hash from string
const hashFromString = crypto
  .createHash("sha256")
  .update(secretString, "utf8")
  .digest();
console.log("Hash from string:", hashFromString.toString("hex"));
console.log(
  "Hash from string matches expected:",
  hashFromString.toString("hex") === expectedHashlock
);

// Test base64 approach
const secretBase64 = secretBuffer.toString("base64");
console.log("Secret as base64:", secretBase64);
const secretFromBase64 = Buffer.from(secretBase64, "base64");
console.log(
  "Secret from base64 matches original:",
  secretFromBase64.equals(secretBuffer)
);

// Calculate hash from base64 string
const hashFromBase64 = crypto
  .createHash("sha256")
  .update(secretBase64, "utf8")
  .digest();
console.log("Hash from base64 string:", hashFromBase64.toString("hex"));
console.log(
  "Hash from base64 string matches expected:",
  hashFromBase64.toString("hex") === expectedHashlock
);

// Test binary string approach
const secretBinaryString = String.fromCharCode(...secretBuffer);
console.log("Secret as binary string length:", secretBinaryString.length);
const secretFromBinaryString = Buffer.from(secretBinaryString, "binary");
console.log(
  "Secret from binary string matches original:",
  secretFromBinaryString.equals(secretBuffer)
);

// Calculate hash from binary string
const hashFromBinaryString = crypto
  .createHash("sha256")
  .update(secretBinaryString, "binary")
  .digest();
console.log("Hash from binary string:", hashFromBinaryString.toString("hex"));
console.log(
  "Hash from binary string matches expected:",
  hashFromBinaryString.toString("hex") === expectedHashlock
);
