import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function resolverComplete(escrowId: number, secret: string) {
  // Withdraw on Eth (transfers to user)
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
  const htlcAbi: any[] = [
    {
      "inputs": [
        {"name": "lockId", "type": "bytes32"},
        {"name": "preimage", "type": "string"}
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
  // For demo purposes, skip Ethereum contract if not deployed
  const htlcAddress = process.env.HTLC_ETH_ADDRESS || "0x0000000000000000000000000000000000000000";
  
  if (htlcAddress === "0x0000000000000000000000000000000000000000") {
    console.log(`Skipping Ethereum withdrawal for demo. HTLC contract not deployed.`);
  } else {
    const htlc = new ethers.Contract(
      htlcAddress,
      htlcAbi,
      wallet
    );
    const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString()));
    const ethTx = await htlc.withdraw(id, secret);
    await ethTx.wait();
    console.log("Withdrawn on Eth (USDC to user). Tx:", ethTx.hash);
  }

  // Withdraw on Near (transfers to resolver)
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(process.env.RESOLVER_NEAR_PRIVATE_KEY! as any);
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
  const nearAccount = await near.account(
    process.env.RESOLVER_NEAR_ACCOUNT_ID!
  );
  try {
    const nearTx = await nearAccount.functionCall({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      methodName: "withdraw",
      args: { id: escrowId, preimage: secret },
      gas: BigInt("30000000000000"),
    });
    console.log(
      "Withdrawn on Near (USDC to resolver). Tx:",
      nearTx.transaction.hash
    );
  } catch (error: any) {
    if (error.type === 'AccountDoesNotExist') {
      console.log(`⚠️  NEAR contract account ${process.env.ESCROW_NEAR_ACCOUNT_ID!} does not exist.`);
      console.log(`For demo purposes, simulating Near withdrawal completion.`);
      console.log(`Escrow ID: ${escrowId}, Secret: "${secret}"`);
    } else if (error.type === 'ActionError' && error.kind?.kind?.FunctionCallError) {
      const executionError = error.kind.kind.FunctionCallError.ExecutionError;
      if (executionError) {
        if (executionError.includes('Withdrawn')) {
          console.log(`⚠️  Escrow ${escrowId} has already been withdrawn.`);
          console.log(`This is expected if you've run this script before.`);
        } else if (executionError.includes('Escrow not found')) {
          console.log(`⚠️  Escrow ${escrowId} not found.`);
          console.log(`Please run 'ts-node setup-escrow-for-testing.ts' first to create an escrow.`);
        } else if (executionError.includes('Resolver not set')) {
          console.log(`⚠️  No resolver registered for escrow ${escrowId}.`);
          console.log(`Please run 'ts-node setup-escrow-for-testing.ts' first to register a resolver.`);
        } else if (executionError.includes('Invalid preimage')) {
          console.log(`⚠️  Invalid secret provided for escrow ${escrowId}.`);
          console.log(`Make sure you're using the correct secret that matches the hashlock.`);
        } else if (executionError.includes('Only resolver during exclusive period')) {
          console.log(`⚠️  Only the registered resolver can withdraw during the exclusive period.`);
          console.log(`Wait for the exclusive period to end or use the correct resolver account.`);
        } else if (executionError.includes('Expired')) {
          console.log(`⚠️  Escrow ${escrowId} has expired and can only be refunded.`);
        } else {
          console.log(`⚠️  Smart contract error: ${executionError}`);
        }
      } else {
        console.error('Error completing Near withdrawal:', error);
      }
    } else {
      console.error('Error completing Near withdrawal:', error);
    }
  }
}

// Example call
resolverComplete(3, "mysecret");
