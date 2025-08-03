import { ethers } from "ethers";

const targetHashlock =
  "0xf272040e74f25aa692b7e4de26986a1f73bad21073e276618674b5a60ebe14f2";

// Try different common secrets
const testSecrets = [
  "mysecret",
  "secret",
  "test",
  "22",
  "escrow22",
  "fayefaye",
  "fayefaye2",
  "testnet",
  "near",
  "ethereum",
  "usdc",
  "1000000",
  "1",
  "0",
  "d320229ed65b9e5a7c93778ec758cbaa81ba2909eae3e4502a54803e530aa843", // the one you tried
  "f272040e74f25aa692b7e4de26986a1f73bad21073e276618674b5a60ebe14f2", // the hashlock itself
  "f272040e74f25aa692b7e4de26986a1f73bad21073e276618674b5a60ebe14f2".slice(2), // without 0x
];

console.log("Testing secrets against target hashlock:", targetHashlock);
console.log("");

for (const secret of testSecrets) {
  const sha256Hash = ethers.sha256(ethers.toUtf8Bytes(secret));
  const keccakHash = ethers.keccak256(ethers.toUtf8Bytes(secret));

  if (sha256Hash === targetHashlock) {
    console.log(`✅ FOUND! Secret "${secret}" has SHA256 hash: ${sha256Hash}`);
    break;
  } else if (keccakHash === targetHashlock) {
    console.log(
      `✅ FOUND! Secret "${secret}" has Keccak256 hash: ${keccakHash}`
    );
    break;
  } else {
    console.log(
      `❌ Secret "${secret}" - SHA256: ${sha256Hash}, Keccak256: ${keccakHash}`
    );
  }
}

console.log("\nIf no match found, the secret might be a random 32-byte value.");
console.log(
  "You may need to check the escrow creation logs or ask the person who created the escrow."
);
