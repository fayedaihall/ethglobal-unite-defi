import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function checkEscrowStatus() {
  const escrowId = parseInt(process.argv[2]) || 28;

  console.log(`Checking status of escrow ${escrowId}...`);

  // Query Near escrow
  const near = await nearAPI.connect({
    networkId: process.env.NEAR_NETWORK,
    nodeUrl: process.env.NEAR_RPC,
  });

  try {
    const result = await near.connection.provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: process.env.ESCROW_NEAR_ACCOUNT_ID,
      method_name: "get_escrow",
      args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString(
        "base64"
      ),
    });

    const escrow = JSON.parse(Buffer.from(result.result).toString());

    console.log("Escrow details:");
    console.log("  ID:", escrowId);
    console.log("  Sender:", escrow.sender);
    console.log("  Token:", escrow.token);
    console.log("  Amount:", escrow.amount);
    console.log("  Hashlock:", escrow.hashlock);
    console.log("  Timelock Exclusive:", escrow.timelock_exclusive);
    console.log("  Timelock Recovery:", escrow.timelock_recovery);
    console.log("  Withdrawn:", escrow.withdrawn);
    console.log("  Resolver:", escrow.resolver);
    console.log("  Dest User:", escrow.dest_user);
    console.log("  Output Token:", escrow.output_token);

    // Check current time
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("\nCurrent time:", currentTime);
    console.log("Exclusive period ends:", escrow.timelock_exclusive);
    console.log("Recovery period ends:", escrow.timelock_recovery);

    console.log("\nTimelock analysis:");
    if (currentTime < escrow.timelock_exclusive) {
      console.log(
        "  ⚠️  Still in exclusive period - only resolver can withdraw"
      );
      console.log("  Expected resolver:", escrow.resolver);
      console.log(
        "  Current resolver account:",
        process.env.RESOLVER_NEAR_ACCOUNT_ID
      );
    } else if (currentTime < escrow.timelock_recovery) {
      console.log("  ✅ In recovery period - anyone can withdraw");
    } else {
      console.log("  ⚠️  Past recovery period - escrow expired");
    }

    if (escrow.withdrawn) {
      console.log("  ⚠️  Escrow already withdrawn");
    } else {
      console.log("  ✅ Escrow not yet withdrawn");
    }
  } catch (error) {
    console.error("Error querying escrow:", error);
  }
}

checkEscrowStatus().catch(console.error);
