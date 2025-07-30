import * as fs from "fs";
import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
dotenv.config();

async function deployNearHTLC() {
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(process.env.NEAR_PRIVATE_KEY! as any);
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.ESCROW_NEAR_ACCOUNT_ID!,
    keyPair
  );
  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };
  const near = await connect(config);
  const account = await near.account(process.env.ESCROW_NEAR_ACCOUNT_ID!);
  const wasm = fs.readFileSync("escrow.wasm");
  const tx = await account.deployContract(wasm);
  console.log("HTLC deployed on Near at: " + process.env.ESCROW_NEAR_ACCOUNT_ID!);
  await account.functionCall({
    contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
    methodName: "new",
    args: {},
    gas: BigInt("30000000000000"),
  });
  console.log("Deployment tx:", tx.transaction.hash);
}

deployNearHTLC();
