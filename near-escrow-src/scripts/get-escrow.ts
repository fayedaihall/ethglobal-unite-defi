import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";

async function getEscrow(escrowId: number): Promise<any> {
  const envFile =
    process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
  dotenv.config({ path: envFile });

  // Validate environment variables
  const escrowAccountId = process.env.ESCROW_NEAR_ACCOUNT_ID;
  if (!escrowAccountId) {
    throw new Error("ESCROW_NEAR_ACCOUNT_ID not set in .env.testnet");
  }
  if (!process.env.NEAR_RPC) {
    throw new Error("NEAR_RPC not set in .env.testnet");
  }
  if (!process.env.NEAR_NETWORK) {
    throw new Error("NEAR_NETWORK not set in .env.testnet");
  }

  const { connect } = nearAPI;
  const config = {
    networkId: process.env.NEAR_NETWORK,
    nodeUrl: process.env.NEAR_RPC,
  };
  const near = await connect(config);
  const result = (await near.connection.provider.query({
    request_type: "call_function",
    finality: "final",
    account_id: escrowAccountId,
    method_name: "get_escrow",
    args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString(
      "base64"
    ),
  })) as any;
  const escrow = JSON.parse(Buffer.from(result.result).toString());
  console.log(`Escrow ID ${escrowId} Details:`);
  console.log("Sender:", escrow.sender);
  console.log("Token:", escrow.token);
  console.log("Amount:", escrow.amount);
  console.log(
    "Hashlock:",
    escrow.hashlock.map((b: number) => b.toString(16).padStart(2, "0")).join("")
  );
  console.log(
    "Timelock Exclusive:",
    new Date(escrow.timelock_exclusive * 1000).toISOString()
  );
  console.log(
    "Timelock Recovery:",
    new Date(escrow.timelock_recovery * 1000).toISOString()
  );
  console.log("Withdrawn:", escrow.withdrawn);
  console.log("Resolver:", escrow.resolver || "None");
  return escrow;
}

// Run with command-line argument
const escrowId = Number(process.argv[2]) || 0;
getEscrow(escrowId).catch((error) => {
  console.error("Error:", error.message);
  if (error.message.includes("No such file or directory")) {
    console.warn("Ensure .env.testnet exists in the project root");
  }
});
