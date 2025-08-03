import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function testPreimageWithoutPrefix() {
  const escrowId = 28;
  const secret =
    "7e9380c1bd884f8e13774df7316804fd25f514027c8f18cae03ac46f0309cad7";

  console.log(`Testing preimage without 0x prefix for escrow ${escrowId}`);
  console.log(`Secret (without 0x): ${secret}`);

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

  try {
    const nearTx = await nearAccount.functionCall({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID,
      methodName: "withdraw",
      args: { id: escrowId, preimage: secret },
      gas: BigInt("30000000000000"),
    });
    console.log(`✅ SUCCESS! Transaction hash: ${nearTx.transaction.hash}`);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
  }
}

testPreimageWithoutPrefix().catch(console.error);
