import * as nearAPI from "near-api-js";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function setupEscrowForTesting() {
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();

  // Setup user account key
  const userKeyPair = KeyPair.fromString(
    process.env.USER_NEAR_PRIVATE_KEY! as any
  );
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.USER_NEAR_ACCOUNT_ID!,
    userKeyPair
  );

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

  try {
    // Step 1: Create an escrow by calling ft_on_transfer
    console.log("Step 1: Creating escrow...");

    // Generate a test secret and its hash
    const secret = "mysecret";
    const hashBuffer = crypto.createHash("sha256").update(secret).digest();
    const hashHex = hashBuffer.toString("hex");

    console.log(`Secret: ${secret}`);
    console.log(`Hash: ${hashHex}`);

    // Mock ft_on_transfer call (in reality this would be called by a fungible token contract)
    const userAccount = await near.account(process.env.USER_NEAR_ACCOUNT_ID!);
    const lockMsg = {
      hashlock: hashHex,
      timelock: 3600, // 1 hour
      dest_chain: "ethereum",
      dest_user: "0x1234567890123456789012345678901234567890",
      min_return: "1000000", // 1 USDC (6 decimals)
      output_token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      // Register resolver in the same transaction
      resolver_id: process.env.RESOLVER_NEAR_ACCOUNT_ID!,
    };

    // Simulate the fungible token contract calling ft_on_transfer
    try {
      const createTx = await userAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        methodName: "ft_on_transfer",
        args: {
          sender_id: process.env.USER_NEAR_ACCOUNT_ID!,
          amount: "1000000", // 1 USDC
          msg: JSON.stringify(lockMsg),
        },
        gas: BigInt("30000000000000"),
        attachedDeposit: BigInt("1"), // Attached deposit for payable function
      });
      console.log(
        "✅ Escrow and resolver registered successfully. Tx:",
        createTx.transaction.hash
      );
    } catch (error: any) {
      console.log(
        "⚠️ Could not create escrow (contract may not exist), continuing with mock..."
      );
    }

    console.log("\n🎯 Setup complete! Now you can run the withdraw operation:");
    console.log("ts-node 04-resolver-complete.ts");
    console.log(`\nEscrow ID: 0`);
    console.log(`Secret: ${secret}`);
    console.log(`Hash: ${hashHex}`);
  } catch (error: any) {
    console.error("Error setting up escrow:", error);

    // Provide mock setup info for testing
    console.log(
      "\n⚠️ Could not set up real escrow, but you can test with mock data:"
    );
    console.log("Escrow ID: 0");
    console.log("Secret: mysecret");
    console.log(
      "Hash: " + crypto.createHash("sha256").update("mysecret").digest("hex")
    );
  }
}

setupEscrowForTesting().catch(console.error);
