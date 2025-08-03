import * as crypto from "crypto";
import { ethers } from "ethers";

function checkSecretHash(secret: string, expectedHashlock: string) {
  console.log("=== Secret and Hashlock Verification ===");
  console.log(`Secret: ${secret}`);
  console.log(`Expected hashlock: ${expectedHashlock}`);
  
  // Method 1: Direct SHA256 of hex string
  const sha256Hash1 = crypto.createHash('sha256').update(secret, 'hex').digest('hex');
  console.log(`\nMethod 1 - SHA256 of hex string: ${sha256Hash1}`);
  console.log(`Match: ${sha256Hash1 === expectedHashlock}`);
  
  // Method 2: SHA256 of UTF-8 string
  const sha256Hash2 = crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
  console.log(`\nMethod 2 - SHA256 of UTF-8 string: ${sha256Hash2}`);
  console.log(`Match: ${sha256Hash2 === expectedHashlock}`);
  
  // Method 3: Ethers keccak256 of hex bytes
  try {
    const ethersHash1 = ethers.keccak256("0x" + secret).slice(2);
    console.log(`\nMethod 3 - Ethers keccak256 of hex: ${ethersHash1}`);
    console.log(`Match: ${ethersHash1 === expectedHashlock}`);
  } catch (e) {
    console.log(`\nMethod 3 - Ethers keccak256 of hex: Error - ${e.message}`);
  }
  
  // Method 4: Ethers keccak256 of UTF-8 string
  try {
    const ethersHash2 = ethers.keccak256(ethers.toUtf8Bytes(secret)).slice(2);
    console.log(`\nMethod 4 - Ethers keccak256 of UTF-8: ${ethersHash2}`);
    console.log(`Match: ${ethersHash2 === expectedHashlock}`);
  } catch (e) {
    console.log(`\nMethod 4 - Ethers keccak256 of UTF-8: Error - ${e.message}`);
  }
  
  // Method 5: Ethers sha256 of hex bytes
  try {
    const ethersHash3 = ethers.sha256("0x" + secret).slice(2);
    console.log(`\nMethod 5 - Ethers sha256 of hex: ${ethersHash3}`);
    console.log(`Match: ${ethersHash3 === expectedHashlock}`);
  } catch (e) {
    console.log(`\nMethod 5 - Ethers sha256 of hex: Error - ${e.message}`);
  }
  
  // Method 6: Ethers sha256 of UTF-8 string
  try {
    const ethersHash4 = ethers.sha256(ethers.toUtf8Bytes(secret)).slice(2);
    console.log(`\nMethod 6 - Ethers sha256 of UTF-8: ${ethersHash4}`);
    console.log(`Match: ${ethersHash4 === expectedHashlock}`);
  } catch (e) {
    console.log(`\nMethod 6 - Ethers sha256 of UTF-8: Error - ${e.message}`);
  }
  
  // Method 7: Try as buffer
  try {
    const buffer = Buffer.from(secret, 'hex');
    const sha256Hash3 = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`\nMethod 7 - SHA256 of buffer from hex: ${sha256Hash3}`);
    console.log(`Match: ${sha256Hash3 === expectedHashlock}`);
  } catch (e) {
    console.log(`\nMethod 7 - SHA256 of buffer from hex: Error - ${e.message}`);
  }
}

// Get command line arguments
const secret = process.argv[2];
const hashlock = process.argv[3];

if (!secret || !hashlock) {
  console.error("Usage: ts-node check-secret-hash.ts <secret> <hashlock>");
  console.error("Example: ts-node check-secret-hash.ts mysecret abc123...");
  process.exit(1);
}

checkSecretHash(secret, hashlock);
