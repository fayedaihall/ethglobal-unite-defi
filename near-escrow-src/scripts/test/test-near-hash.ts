import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config();
const envFile = process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function testNearHashValidation(escrowId: number, secret: string) {
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  
  // Setup resolver account key
  const resolverKeyPair = KeyPair.fromString(process.env.RESOLVER_NEAR_PRIVATE_KEY! as any);
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.RESOLVER_NEAR_ACCOUNT_ID!,
    resolverKeyPair
  );

  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };

  const near = await connect(config);
  
  // First, get the escrow details
  console.log("=== Getting Escrow Details ===");
  const result = await near.connection.provider.query({
    request_type: "call_function",
    finality: "final",
    account_id: process.env.ESCROW_NEAR_ACCOUNT_ID!,
    method_name: "get_escrow",
    args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString("base64"),
  }) as any;
  
  const escrow = JSON.parse(Buffer.from(result.result).toString());
  const hashlockHex = escrow.hashlock.map((b: number) => b.toString(16).padStart(2, "0")).join("");
  
  console.log(`Escrow ID: ${escrowId}`);
  console.log(`Hashlock from contract: ${hashlockHex}`);
  console.log(`Secret: ${secret}`);
  
  // Test local hash validation (same logic as our updated contract)
  console.log("\n=== Local Hash Validation (Contract Logic) ===");
  
  // Try to decode as hex first
  let preimageBytes: Buffer;
  try {
    preimageBytes = Buffer.from(secret, 'hex');
    console.log(`Decoded secret as hex: ${preimageBytes.toString('hex')}`);
  } catch (e) {
    preimageBytes = Buffer.from(secret, 'utf8');
    console.log(`Using secret as UTF-8: ${preimageBytes.toString('hex')}`);
  }
  
  const hash = crypto.createHash('sha256').update(preimageBytes).digest();
  const hashHex = hash.toString('hex');
  
  console.log(`Computed hash: ${hashHex}`);
  console.log(`Expected hash: ${hashlockHex}`);
  console.log(`Match: ${hashHex === hashlockHex}`);
  
  // Compare byte arrays
  const hashlockBytes = Buffer.from(hashlockHex, 'hex');
  console.log(`Hash bytes match: ${Buffer.compare(hash, hashlockBytes) === 0}`);
  
  if (hashHex === hashlockHex) {
    console.log("\n✅ Hash validation should work! The issue might be elsewhere.");
  } else {
    console.log("\n❌ Hash validation will fail. Secret doesn't match hashlock.");
  }
}

// Get command line arguments
const escrowId = Number(process.argv[2]);
const secret = process.argv[3];

if (!escrowId || isNaN(escrowId) || !secret) {
  console.error("Usage: ts-node test-near-hash.ts <escrowId> <secret>");
  console.error("Example: ts-node test-near-hash.ts 32 abc123...");
  process.exit(1);
}

testNearHashValidation(escrowId, secret).catch(console.error);
