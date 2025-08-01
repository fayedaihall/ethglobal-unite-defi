import { Near, providers } from "near-api-js";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function getHashlock(escrowId: number): Promise<string> {
  const provider = new providers.JsonRpcProvider({
    url: process.env.NEAR_RPC!,
  });
  const result = await provider.query<any>({
    request_type: "call_function",
    finality: "final",
    account_id: "escrow-contract.fayefaye2.testnet", // Use the deployed escrow contract
    method_name: "get_escrow",
    args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString(
      "base64"
    ),
  });
  const escrow = JSON.parse(Buffer.from(result.result).toString());
  const hashlock = Buffer.from(escrow.hashlock).toString("hex"); // No need for base64 to hex, it should be hex already
  console.log(`Hashlock for escrow ID ${escrowId}: ${hashlock}`);
  return hashlock;
}

// Get command line arguments
const escrowId = Number(process.argv[2]);

if (!escrowId || isNaN(escrowId)) {
  console.error("Usage: ts-node get-hashlock.ts <escrowId>");
  console.error("Example: ts-node get-hashlock.ts 26");
  process.exit(1);
}

getHashlock(escrowId).catch(console.error);
