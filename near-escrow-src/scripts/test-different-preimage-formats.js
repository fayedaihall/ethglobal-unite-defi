import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function testDifferentPreimageFormats() {
  const escrowId = 28;
  const secret =
    "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";

  console.log(`Testing different preimage formats for escrow ${escrowId}`);
  console.log(`Original secret: ${secret}`);

  // Test different formats
  const formats = [
    { name: "Original hex string", value: secret },
    { name: "Without 0x prefix", value: secret.replace("0x", "") },
    { name: "Uppercase", value: secret.toUpperCase() },
    { name: "As base64", value: Buffer.from(secret, "hex").toString("base64") },
    {
      name: "As raw bytes string",
      value: Buffer.from(secret, "hex").toString("utf8"),
    },
  ];

  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(process.env.RESOLVER_NEAR_PRIVATE_KEY);
  await keyStore.setKey(
    process.env.NEAR_NETWORK,
    process.env.RESOLVER_NEAR_ACCOUNT_ID,
    keyPair
  );

  const config = {
    networkId: process.env.NEAR_NETWORK,
    keyStore,
    nodeUrl: process.env.NEAR_RPC,
  };
  const near = await connect(config);
  const nearAccount = await near.account(process.env.RESOLVER_NEAR_ACCOUNT_ID);

  for (const format of formats) {
    console.log(`\nTesting format: ${format.name}`);
    console.log(`Value: ${format.value}`);

    try {
      const nearTx = await nearAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID,
        methodName: "withdraw",
        args: { id: escrowId, preimage: format.value },
        gas: BigInt("30000000000000"),
      });
      console.log(`✅ SUCCESS with format: ${format.name}`);
      console.log(`Transaction hash: ${nearTx.transaction.hash}`);
      return; // Stop after first success
    } catch (error) {
      console.log(`❌ Failed with format: ${format.name}`);
      console.log(`Error: ${error.message}`);
    }
  }

  console.log("\n❌ All formats failed");
}

testDifferentPreimageFormats().catch(console.error);
