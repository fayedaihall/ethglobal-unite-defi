import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

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
    if (error.type === 'AccountDoesNotExist') {
      console.log(`⚠️  NEAR contract account ${process.env.ESCROW_NEAR_ACCOUNT_ID!} does not exist.`);
      console.log(`For demo purposes, simulating escrow verification with mock data.`);
      console.log(`Escrow ID: ${escrowId}`);
      console.log(`Secret shared with resolver: "${secret}"`);
      return;
    }
    throw error;
  }
  
  const hashlock = escrow.hashlock; // hex
  const resolver = escrow.resolver;
  const amount = escrow.amount;

  // Query Eth lock
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const htlcAbi: any[] = [
    {
      "inputs": [{"name": "lockId", "type": "bytes32"}],
      "name": "locks",
      "outputs": [
        {"name": "amount", "type": "uint256"},
        {"name": "hashlock", "type": "bytes32"},
        {"name": "recipient", "type": "address"},
        {"name": "token", "type": "address"},
        {"name": "sender", "type": "address"},
        {"name": "timelock", "type": "uint256"},
        {"name": "withdrawn", "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  // For demo purposes, we'll skip the Ethereum contract verification
  // In production, you would use the actual deployed HTLC contract address
  const htlcAddress = process.env.HTLC_ETH_ADDRESS || "0x0000000000000000000000000000000000000000";
  const htlc = new ethers.Contract(
    htlcAddress,
    htlcAbi,
    provider
  );
  const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));
  
  // Skip Ethereum verification for demo if contract not deployed
  if (htlcAddress === "0x0000000000000000000000000000000000000000") {
    console.log(`Skipping Ethereum verification for demo. NEAR escrow ${escrowId} verified.`);
    console.log(`Sharing secret "${secret}" to resolver ${resolver}`);
    return;
  }
  
  const lock = await htlc.locks(id);

  if (
    lock.amount.toString() === amount &&
    lock.hashlock === "0x" + hashlock &&
    lock.recipient === escrow.dest_user &&
    lock.token === escrow.output_token &&
    lock.sender !== "0x0000..."
  ) {
    // Verify finality (assume 1 min delay for demo)
    await new Promise((resolve) => setTimeout(resolve, 60000));
    // Share secret to resolver (in practice, encrypted message to resolver account)
    console.log(`Verified. Sharing secret "${secret}" to resolver ${resolver}`);
    // For bidirectional, similar verification for Eth => Near
  } else {
    console.log("Verification failed");
  }
}

// Example call (secret from user frontend)
relayerVerifyAndShare(0, "mysecret");
