import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

type NearPrivateKey = `ed25519:${string}`;

async function resolverFill(
  escrowId: number,
  fillAmount: string,
  secret: string,
  userEthAddress: string
) {
  const envFile =
    process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
  dotenv.config({ path: envFile });

  if (!process.env.RESOLVER_NEAR_PRIVATE_KEY) {
    throw new Error("RESOLVER_NEAR_PRIVATE_KEY is not set in .env");
  }
  if (!process.env.RESOLVER_NEAR_ACCOUNT_ID) {
    throw new Error("RESOLVER_NEAR_ACCOUNT_ID is not set in .env");
  }

  // Validate private key format
  if (!process.env.RESOLVER_NEAR_PRIVATE_KEY.startsWith("ed25519:")) {
    throw new Error("RESOLVER_NEAR_PRIVATE_KEY must start with 'ed25519:'");
  }
  // Step 4.1: Register as resolver on Near
  const { keyStores, Near, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(
    process.env.RESOLVER_NEAR_PRIVATE_KEY! as NearPrivateKey
  );

  console.log(
    "Using resolver account ID:",
    process.env.RESOLVER_NEAR_ACCOUNT_ID
  );
  console.log("Public key for resolver:", keyPair.getPublicKey().toString());

  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.RESOLVER_NEAR_ACCOUNT_ID!,
    keyPair
  );
  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
    walletUrl: `https://testnet.mynearwallet.com/`,
    helperUrl: `https://helper.testnet.near.org`,
    explorerUrl: `https://testnet.nearblocks.io`,
  };
  const near = new Near(config);
  const nearAccount = await near.account(process.env.RESOLVER_NEAR_ACCOUNT_ID!);

  const escrowContractId = process.env.ESCROW_NEAR_ACCOUNT_ID!;
  console.log(`Attempting to call escrow contract at: ${escrowContractId}`);

  // First, let's check if the escrow contract exists
  try {
    const accountInfo = await nearAccount.getAccountDetails();
    console.log(`Resolver account details:`, accountInfo);

    // Try to check if escrow contract exists
    const escrowAccount = await near.account(escrowContractId);
    const escrowInfo = await escrowAccount.getAccountDetails();
    console.log(`Escrow contract account details:`, escrowInfo);
  } catch (error: any) {
    console.log(`Error checking accounts:`, error.message);
  }

  try {
    const registerTx = await nearAccount.functionCall({
      contractId: escrowContractId,
      methodName: "register_resolver",
      args: { id: escrowId },
      gas: BigInt("30000000000000"),
    });
    console.log(
      "Registered as resolver on Near. Tx:",
      registerTx.transaction.hash
    );
  } catch (error: any) {
    console.error(`Function call failed:`, error.message);
    console.error(`Error type:`, error.type);
    console.error(`Full error:`, JSON.stringify(error, null, 2));

    if (error.message && error.message.includes("CodeDoesNotExist")) {
      console.log(
        `\n❌ The escrow contract '${escrowContractId}' does not exist.`
      );
      console.log(`This is likely because:`);
      console.log(`1. The escrow contract hasn't been deployed to testnet yet`);
      console.log(`2. The contract is deployed under a different account ID`);
      console.log(`3. You need to deploy the escrow contract first`);
      console.log(`\nTo fix this, you should either:`);
      console.log(`- Deploy the escrow contract to '${escrowContractId}'`);
      console.log(
        `- Update the contract ID in the code to match the actual deployed contract`
      );
      return; // Exit gracefully instead of throwing
    }
    throw error; // Re-throw other errors
  }

  // Step 4.2: Create lock on Eth (deposit USDC)
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(
    process.env.ETH_PRIVATE_KEY || process.env.RESOLVER_ETH_PRIVATE_KEY!,
    provider
  );
  const htlcAbi: ethers.InterfaceAbi = [
    /* HTLC ABI here */
    // Add your HTLC contract ABI methods here
    "function createLock(bytes32,address,address,uint256,bytes32,uint256) returns(bool)",
    "function withdraw(bytes32,string) returns(bool)",
    "function refund(bytes32) returns(bool)",
    "function locks(bytes32) view returns (address, address, address, uint256, bytes32, uint256, bool)",
  ];
  const htlcAddress = ethers.getAddress(process.env.HTLC_ETH_ADDRESS!);
  const usdcAddress = ethers.getAddress(process.env.USDC_ETH_ADDRESS!); // Validate and normalize address

  console.log(`HTLC contract address: ${htlcAddress}`);
  console.log(`USDC contract address: ${usdcAddress}`);

  const htlc = new ethers.Contract(htlcAddress, htlcAbi, wallet);
  const usdc = new ethers.Contract(
    usdcAddress,
    ["function approve(address,uint256) returns(bool)"],
    wallet
  );

  console.log(
    `Attempting to approve ${fillAmount} USDC for HTLC at ${htlcAddress}`
  );

  // Get current nonce to avoid nonce conflicts
  const currentNonce = await wallet.getNonce();
  console.log(`Using nonce for approval: ${currentNonce}`);

  const approveTx = await usdc.approve(htlcAddress, fillAmount, {
    nonce: currentNonce,
  });
  await approveTx.wait();
  console.log(`USDC approval completed. Tx: ${approveTx.hash}`);

  const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString())); // Unique ID
  const hashlock = ethers.sha256(Buffer.from(secret, "hex")); // Use SHA256 to match NEAR contract
  const timelock = 7200; // 2 hours

  // Validate user Ethereum address
  const validUserAddress =
    userEthAddress === "0xuser"
      ? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
      : ethers.getAddress(userEthAddress);

  // Use the next sequential nonce for the createLock transaction
  const nextNonce = currentNonce + 1;
  console.log(`Creating HTLC lock with nonce: ${nextNonce}`);

  const createTx = await htlc.createLock(
    id,
    validUserAddress,
    usdcAddress,
    fillAmount,
    hashlock,
    timelock,
    { nonce: nextNonce }
  );
  await createTx.wait();
  console.log(
    "Lock created on Eth. Tx (token transfer to escrow):",
    createTx.hash
  );

  // Log detailed lock information
  console.log("\n🔒 Ethereum HTLC Lock Details:");
  console.log(`Lock ID: ${id}`);
  console.log(`Recipient: ${validUserAddress}`);
  console.log(`Token: ${usdcAddress}`);
  console.log(`Amount: ${fillAmount} (${parseInt(fillAmount) / 1000000} USDC)`);
  console.log(`Hashlock: ${hashlock}`);
  console.log(`Timelock: ${timelock} seconds (${timelock / 3600} hours)`);
  console.log(`Transaction Hash: ${createTx.hash}`);
  console.log(`Block Number: ${createTx.blockNumber}`);
  console.log(`Gas Used: ${createTx.gasUsed?.toString() || "N/A"}`);
  console.log(`Gas Price: ${createTx.gasPrice?.toString() || "N/A"}`);

  // Calculate lock expiry time
  const currentBlock = await provider.getBlock(createTx.blockNumber!);
  const lockExpiryTime = new Date((currentBlock!.timestamp + timelock) * 1000);
  console.log(`Lock Expiry: ${lockExpiryTime.toISOString()}`);
  console.log(`Current Time: ${new Date().toISOString()}`);
  console.log(
    `Time Remaining: ${Math.floor(
      (lockExpiryTime.getTime() - Date.now()) / 1000
    )} seconds`
  );
}

// Get command line arguments
const escrowId = Number(process.argv[2]);
const fillAmount = process.argv[3];
const secret = process.argv[4];
const userEthAddress = process.argv[5];

if (!escrowId || isNaN(escrowId)) {
  console.error(
    "Usage: ts-node 02-resolver-fill.ts <escrowId> <fillAmount> <secret> <userEthAddress>"
  );
  console.error(
    "Example: ts-node 02-resolver-fill.ts 0 1000000 652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0 0x617206eb31554a759eDec3d644b88C6892a0343D"
  );
  process.exit(1);
}

if (!fillAmount) {
  console.error(
    "Usage: ts-node 02-resolver-fill.ts <escrowId> <fillAmount> <secret> <userEthAddress>"
  );
  console.error(
    "Example: ts-node 02-resolver-fill.ts 0 1000000 652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0 0x617206eb31554a759eDec3d644b88C6892a0343D"
  );
  process.exit(1);
}

if (!secret) {
  console.error(
    "Usage: ts-node 02-resolver-fill.ts <escrowId> <fillAmount> <secret> <userEthAddress>"
  );
  console.error(
    "Example: ts-node 02-resolver-fill.ts 0 1000000 652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0 0x617206eb31554a759eDec3d644b88C6892a0343D"
  );
  process.exit(1);
}

if (!userEthAddress) {
  console.error(
    "Usage: ts-node 02-resolver-fill.ts <escrowId> <fillAmount> <secret> <userEthAddress>"
  );
  console.error(
    "Example: ts-node 02-resolver-fill.ts 0 1000000 652c7dc687d98c9889304ed2e408c74b611e86a40caa51c4b43f1dd5913c5cd0 0x617206eb31554a759eDec3d644b88C6892a0343D"
  );
  process.exit(1);
}

resolverFill(escrowId, fillAmount, secret, userEthAddress).catch(console.error);
