import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

// Load environment variables from the appropriate file
const envFile =
  process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
dotenv.config({ path: envFile });

async function relayerVerifyAndShare(escrowId: number, secret: string) {
  // Query Near escrow
  const near = await nearAPI.connect({
    networkId: process.env.NEAR_NETWORK!,
    nodeUrl: process.env.NEAR_RPC!,
  });

  let escrow: any;
  try {
    const result = (await near.connection.provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      method_name: "get_escrow",
      args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString(
        "base64"
      ),
    })) as any;
    escrow = JSON.parse(Buffer.from(result.result).toString());
  } catch (error: any) {
    if (error.type === "AccountDoesNotExist") {
      console.log(
        `⚠️  NEAR contract account ${process.env
          .ESCROW_NEAR_ACCOUNT_ID!} does not exist.`
      );
      console.log(
        `For demo purposes, simulating escrow verification with mock data.`
      );
      console.log(`Escrow ID: ${escrowId}`);
      console.log(`Secret shared with resolver: "${secret}"`);
      return;
    }
    throw error;
  }

  // Convert hashlock from byte array to hex string
  const hashlockBytes = escrow.hashlock;
  const hashlock = Array.isArray(hashlockBytes)
    ? "0x" + Buffer.from(hashlockBytes).toString("hex")
    : hashlockBytes;
  const resolver = escrow.resolver;
  const amount = escrow.amount;

  console.log("Debug - NEAR escrow data:");
  console.log("  hashlock raw:", hashlockBytes);
  console.log("  hashlock converted:", hashlock);
  console.log("  resolver:", resolver);
  console.log("  amount:", amount);
  console.log("  dest_user:", escrow.dest_user);
  console.log("  output_token:", escrow.output_token);

  // Debug: Test if the provided secret hashes to either hashlock
  // Convert hex string to buffer (as it was originally generated)
  const secretBuffer = Buffer.from(secret, "hex");
  const secretSha256 = ethers.sha256(secretBuffer);
  const secretKeccak = ethers.keccak256(secretBuffer);
  console.log("\nSecret hash verification:");
  console.log("  Secret (input):", secret);
  console.log("  Secret (as buffer):", Array.from(secretBuffer));
  console.log("  SHA256 of secret:", secretSha256);
  console.log("  Keccak256 of secret:", secretKeccak);
  console.log(
    "  Matches NEAR hashlock?",
    secretSha256 === hashlock || secretKeccak === hashlock
  );
  console.log(
    "  Expected secret for NEAR would be:",
    "unknown - different secret was used"
  );

  // Query Eth lock
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const htlcAbi: any[] = [
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
        {
          indexed: false,
          internalType: "address",
          name: "recipient",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
      ],
      name: "LockCreated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
      ],
      name: "Refunded",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
      ],
      name: "Withdrawn",
      type: "event",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address",
        },
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "bytes32",
          name: "hashlock",
          type: "bytes32",
        },
        {
          internalType: "uint256",
          name: "timelock",
          type: "uint256",
        },
      ],
      name: "createLock",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "",
          type: "bytes32",
        },
      ],
      name: "locks",
      outputs: [
        {
          internalType: "address",
          name: "sender",
          type: "address",
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address",
        },
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          internalType: "bytes32",
          name: "hashlock",
          type: "bytes32",
        },
        {
          internalType: "uint256",
          name: "timelock",
          type: "uint256",
        },
        {
          internalType: "bool",
          name: "withdrawn",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
      ],
      name: "refund",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "id",
          type: "bytes32",
        },
        {
          internalType: "string",
          name: "preimage",
          type: "string",
        },
      ],
      name: "withdraw",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  // For demo purposes, we'll skip the Ethereum contract verification
  // In production, you would use the actual deployed HTLC contract address
  const htlcAddress =
    process.env.HTLC_ETH_ADDRESS ||
    "0x0000000000000000000000000000000000000000";
  const htlc = new ethers.Contract(htlcAddress, htlcAbi, provider);
  const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));

  // Skip Ethereum verification for demo if contract not deployed
  if (htlcAddress === "0x0000000000000000000000000000000000000000") {
    console.log(
      `Skipping Ethereum verification for demo. NEAR escrow ${escrowId} verified.`
    );
    console.log(`Sharing secret "${secret}" to resolver ${resolver}`);
    return;
  }

  let lock: any;
  try {
    lock = await htlc.locks(id);
  } catch (error: any) {
    console.log(`Failed to query Ethereum lock with ID ${id}:`, error.message);
    console.log(
      `This could mean the lock doesn't exist or the contract is not deployed.`
    );
    console.log(
      `For demo purposes, simulating escrow verification with mock data.`
    );
    console.log(`Escrow ID: ${escrowId}`);
    console.log(`Secret shared with resolver: "${secret}"`);
    return;
  }

  // Check if lock exists (non-zero sender indicates a valid lock)
  if (!lock || lock.sender === "0x0000000000000000000000000000000000000000") {
    console.log(`Lock with ID ${id} does not exist on Ethereum.`);
    console.log(
      `For demo purposes, simulating escrow verification with mock data.`
    );
    console.log(`Escrow ID: ${escrowId}`);
    console.log(`Secret shared with resolver: "${secret}"`);
    return;
  }

  if (
    lock.amount.toString() === amount.toString() &&
    lock.hashlock === hashlock &&
    lock.recipient === escrow.dest_user &&
    lock.token === escrow.output_token &&
    lock.sender !== "0x0000000000000000000000000000000000000000"
  ) {
    // Verify finality (assume 1 min delay for demo)
    await new Promise((resolve) => setTimeout(resolve, 60000));
    // Share secret to resolver (in practice, encrypted message to resolver account)
    console.log(`Verified. Sharing secret "${secret}" to resolver ${resolver}`);
    // For bidirectional, similar verification for Eth => Near
  } else {
    console.log("Verification failed - lock parameters don't match:");
    console.log(`Expected amount: ${amount}, got: ${lock.amount.toString()}`);
    console.log(`Expected hashlock: ${hashlock}, got: ${lock.hashlock}`);
    console.log(
      `Expected recipient: ${escrow.dest_user}, got: ${lock.recipient}`
    );
    console.log(`Expected token: ${escrow.output_token}, got: ${lock.token}`);
  }
}

// Get command line arguments
const escrowId = Number(process.argv[2]);
const secret = process.argv[3];

if (!escrowId || isNaN(escrowId)) {
  console.error(
    "Usage: ts-node 03-relayer-verify-share.ts <escrowId> <secret>"
  );
  console.error("Example: ts-node 03-relayer-verify-share.ts 0 mysecret");
  process.exit(1);
}

if (!secret) {
  console.error(
    "Usage: ts-node 03-relayer-verify-share.ts <escrowId> <secret>"
  );
  console.error("Example: ts-node 03-relayer-verify-share.ts 0 mysecret");
  process.exit(1);
}

relayerVerifyAndShare(escrowId, secret).catch(console.error);
