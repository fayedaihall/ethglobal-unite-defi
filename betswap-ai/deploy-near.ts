import * as fs from "fs";
import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

dotenv.config();
// Load environment variables from the appropriate file
const envFile = process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function deployNearHTLC() {
  const { keyStores, connect, KeyPair } = nearAPI;

  // Validate required environment variables
  if (!process.env.USER_NEAR_PRIVATE_KEY) {
    throw new Error("USER_NEAR_PRIVATE_KEY not found in environment variables");
  }
  if (!process.env.ESCROW_NEAR_ACCOUNT_ID) {
    throw new Error("ESCROW_NEAR_ACCOUNT_ID not found in environment variables");
  }
  if (!process.env.NEAR_NETWORK) {
    throw new Error("NEAR_NETWORK not found in environment variables");
  }
  if (!process.env.NEAR_RPC) {
    throw new Error("NEAR_RPC not found in environment variables");
  }

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(process.env.USER_NEAR_PRIVATE_KEY as any);
  
  // For subaccounts, use the parent account's key
  const deployerAccount = process.env.USER_NEAR_ACCOUNT_ID!; // fayefaye2.testnet
  
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    deployerAccount,
    keyPair
  );
  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };
  const near = await connect(config);
  const account = await near.account(process.env.ESCROW_NEAR_ACCOUNT_ID!);
  const wasm = fs.readFileSync("target/near/near_escrow_src.wasm");
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
