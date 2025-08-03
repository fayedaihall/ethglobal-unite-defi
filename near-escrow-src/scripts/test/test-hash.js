import { ethers } from "ethers";
import * as crypto from "crypto";

// The secret from the escrow creation
const secretHex =
  "96f93e27a355f849f5892f542177e669c8546b2cfb4652cd91fee4eab622c36f";

// Convert hex string back to buffer (as it was originally generated)
const secretBuffer = Buffer.from(secretHex, "hex");

console.log("Secret (hex):", secretHex);
console.log("Secret (buffer):", secretBuffer);
console.log("Secret (buffer as array):", Array.from(secretBuffer));

// Hash the buffer directly (as done in the creation script)
const hashlockFromBuffer = ethers.sha256(secretBuffer).slice(2);
console.log("Hashlock from buffer:", hashlockFromBuffer);

// Hash the hex string (as done in verification script)
const hashlockFromString = ethers
  .sha256(ethers.toUtf8Bytes(secretHex))
  .slice(2);
console.log("Hashlock from string:", hashlockFromString);

// Expected hashlock from the escrow
const expectedHashlock =
  "5206504629932dcc4066ea916bd49c08e562198750fd6409c24b57dd93a381fe";

console.log("\nComparison:");
console.log("Expected:", expectedHashlock);
console.log("From buffer:", hashlockFromBuffer);
console.log("From string:", hashlockFromString);
console.log("Buffer matches:", hashlockFromBuffer === expectedHashlock);
console.log("String matches:", hashlockFromString === expectedHashlock);
