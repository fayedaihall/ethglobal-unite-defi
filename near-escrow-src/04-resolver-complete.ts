import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function checkEscrowStatus(
  escrowId: number
): Promise<{ exists: boolean; withdrawn: boolean; resolver?: string }> {
  const { keyStores, connect } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();

  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };

  const near = await connect(config);

  try {
    const account = await near.account(process.env.ESCROW_NEAR_ACCOUNT_ID!);
    const result = await account.viewFunction({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      methodName: "get_escrow",
      args: { id: escrowId },
    });

    if (!result) {
      return { exists: false, withdrawn: false };
    }

    return {
      exists: true,
      withdrawn: result.withdrawn || false,
      resolver: result.resolver,
    };
  } catch (error: any) {
    if (error.message && error.message.includes("Escrow not found")) {
      return { exists: false, withdrawn: false };
    }
    // Handle other errors by returning not found
    console.log(`Warning: Could not check escrow status: ${error.message}`);
    return { exists: false, withdrawn: false };
  }
}

async function resolverComplete(escrowId: number, secret: string) {
  console.log(`🔍 Checking escrow ${escrowId} status...`);

  // Check escrow status before attempting withdrawal
  const escrowStatus = await checkEscrowStatus(escrowId);

  if (!escrowStatus.exists) {
    console.log(`❌ Escrow ${escrowId} does not exist.`);
    console.log(
      `Please run 'ts-node setup-escrow-for-testing.ts' first to create an escrow.`
    );
    return;
  }

  if (escrowStatus.withdrawn) {
    console.log(`✅ Escrow ${escrowId} has already been withdrawn.`);
    console.log(`No further action needed.`);
    return;
  }

  console.log(`📋 Escrow ${escrowId} status:`);
  console.log(`   - Exists: ✅`);
  console.log(`   - Withdrawn: ${escrowStatus.withdrawn ? "✅" : "❌"}`);
  console.log(`   - Resolver: ${escrowStatus.resolver || "None"}`);

  if (!escrowStatus.resolver) {
    console.log(`⚠️  No resolver registered for escrow ${escrowId}.`);
    console.log(`🔄 Automatically registering resolver...`);

    try {
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

      const registerTx = await resolverAccount.functionCall({
        contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        methodName: "register_resolver",
        args: { id: escrowId },
        gas: BigInt("30000000000000"),
      });

      console.log(
        `✅ Resolver registered successfully. Tx:`,
        registerTx.transaction.hash
      );

      // Re-check escrow status to confirm resolver is now registered
      const updatedStatus = await checkEscrowStatus(escrowId);
      if (!updatedStatus.resolver) {
        console.log(`❌ Failed to register resolver. Please try again.`);
        return;
      }

      console.log(`✅ Resolver registration confirmed.`);
    } catch (error: any) {
      console.error(`❌ Failed to register resolver:`, error);
      console.log(
        `Please run 'ts-node register-resolver.ts ${escrowId}' manually.`
      );
      return;
    }
  }

  console.log(`🚀 Proceeding with withdrawal...`);

  // Withdraw on Eth (transfers to user)
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
  const htlcAbi: any[] = [
    {
      inputs: [
        { name: "lockId", type: "bytes32" },
        { name: "preimage", type: "bytes" },
      ],
      name: "withdraw",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  // For demo purposes, skip Ethereum contract if not deployed
  const htlcAddress =
    process.env.HTLC_ETH_ADDRESS ||
    "0x0000000000000000000000000000000000000000";

  if (htlcAddress === "0x0000000000000000000000000000000000000000") {
    console.log(
      `Skipping Ethereum withdrawal for demo. HTLC contract not deployed.`
    );
  } else {
    try {
      const htlc = new ethers.Contract(htlcAddress, htlcAbi, wallet);
      const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));
      const preimageBytes = Buffer.from(secret, "hex");
      const ethTx = await htlc.withdraw(id, preimageBytes);
      await ethTx.wait();
      console.log("Withdrawn on Eth (USDC to user). Tx:", ethTx.hash);
    } catch (error: any) {
      if (error.reason === "Withdrawn") {
        console.log(
          "Ethereum HTLC already withdrawn, proceeding to NEAR withdrawal..."
        );
      } else {
        console.log(
          "Ethereum withdrawal error:",
          error.reason || error.message
        );
      }
    }
  }

  // Withdraw on Near (transfers to resolver)
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(
    process.env.RESOLVER_NEAR_PRIVATE_KEY! as any
  );
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.RESOLVER_NEAR_ACCOUNT_ID!,
    keyPair
  );
  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };
  const near = await connect(config);
  const nearAccount = await near.account(process.env.RESOLVER_NEAR_ACCOUNT_ID!);
  try {
    // Pass hex secret directly - the contract will decode it
    const nearTx = await nearAccount.functionCall({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      methodName: "withdraw",
      args: { id: escrowId, preimage: secret },
      gas: BigInt("30000000000000"),
    });
    console.log(
      "✅ Withdrawn on Near (USDC to resolver). Tx:",
      nearTx.transaction.hash
    );
    console.log(`🎉 Escrow ${escrowId} withdrawal completed successfully!`);
  } catch (error: any) {
    if (error.type === "AccountDoesNotExist") {
      console.log(
        `⚠️  NEAR contract account ${process.env
          .ESCROW_NEAR_ACCOUNT_ID!} does not exist.`
      );
      console.log(`For demo purposes, simulating Near withdrawal completion.`);
      console.log(`Escrow ID: ${escrowId}, Secret: "${secret}"`);
    } else if (
      error.type === "ActionError" &&
      error.kind?.kind?.FunctionCallError
    ) {
      const executionError = error.kind.kind.FunctionCallError.ExecutionError;
      if (executionError) {
        if (executionError.includes("Withdrawn")) {
          console.log(`✅ Escrow ${escrowId} has already been withdrawn.`);
          console.log(
            `The withdrawal was completed successfully in a previous run.`
          );
        } else if (executionError.includes("Escrow not found")) {
          console.log(`⚠️  Escrow ${escrowId} not found.`);
          console.log(
            `Please run 'ts-node setup-escrow-for-testing.ts' first to create an escrow.`
          );
        } else if (executionError.includes("Resolver not set")) {
          console.log(`⚠️  No resolver registered for escrow ${escrowId}.`);
          console.log(
            `Please run 'ts-node setup-escrow-for-testing.ts' first to register a resolver.`
          );
        } else if (executionError.includes("Invalid preimage")) {
          console.log(`⚠️  Invalid secret provided for escrow ${escrowId}.`);
          console.log(
            `Make sure you're using the correct secret that matches the hashlock.`
          );
        } else if (
          executionError.includes("Only resolver during exclusive period")
        ) {
          console.log(
            `⚠️  Only the registered resolver can withdraw during the exclusive period.`
          );
          console.log(
            `Wait for the exclusive period to end or use the correct resolver account.`
          );
        } else if (executionError.includes("Expired")) {
          console.log(
            `⚠️  Escrow ${escrowId} has expired and can only be refunded.`
          );
        } else {
          console.log(`⚠️  Smart contract error: ${executionError}`);
        }
      } else {
        console.error("Error completing Near withdrawal:", error);
      }
    } else {
      console.error("Error completing Near withdrawal:", error);
    }
  }
}

// Get command line arguments
const escrowId = Number(process.argv[2]);
const secret = process.argv[3];

if (!escrowId || isNaN(escrowId)) {
  console.error("Usage: ts-node 04-resolver-complete.ts <escrowId> <secret>");
  console.error("Example: ts-node 04-resolver-complete.ts 0 abc123");
  process.exit(1);
}

if (!secret) {
  console.error("Usage: ts-node 04-resolver-complete.ts <escrowId> <secret>");
  console.error("Example: ts-node 04-resolver-complete.ts 0 abc123");
  process.exit(1);
}

resolverComplete(escrowId, secret).catch(console.error);
