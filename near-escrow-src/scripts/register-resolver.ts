import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function registerResolver(escrowId: number) {
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();

  // Setup resolver account key
  const resolverKeyPair = KeyPair.fromString(
    process.env.RESOLVER_NEAR_PRIVATE_KEY! as any
  );
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
  const resolverAccount = await near.account(
    process.env.RESOLVER_NEAR_ACCOUNT_ID!
  );

  try {
    console.log(
      `Registering resolver ${process.env
        .RESOLVER_NEAR_ACCOUNT_ID!} for escrow ${escrowId}...`
    );

    const registerTx = await resolverAccount.functionCall({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      methodName: "register_resolver",
      args: { id: escrowId },
      gas: BigInt("30000000000000"),
    });

    console.log(
      "✅ Resolver registered successfully. Tx:",
      registerTx.transaction.hash
    );
    console.log("Now you can run: ts-node 04-resolver-complete.ts");
  } catch (error: any) {
    console.error("Error registering resolver:", error);
  }
}

// Get command line arguments
const escrowId = Number(process.argv[2]);

if (!escrowId || isNaN(escrowId)) {
  console.error("Usage: ts-node register-resolver.ts <escrowId>");
  console.error("Example: ts-node register-resolver.ts 34");
  process.exit(1);
}

registerResolver(escrowId).catch(console.error);
