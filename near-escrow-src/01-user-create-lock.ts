import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

type NearPrivateKey = `ed25519:${string}`;

async function createLockOnNear() {
  const { Near, keyStores, KeyPair } = nearAPI;

  // Validate environment variables
  if (!process.env.USER_NEAR_PRIVATE_KEY) {
    throw new Error("USER_NEAR_PRIVATE_KEY is not set in .env");
  }
  if (!process.env.USER_NEAR_ACCOUNT_ID) {
    throw new Error("USER_NEAR_ACCOUNT_ID is not set in .env");
  }
  if (!process.env.NEAR_NETWORK) {
    throw new Error("NEAR_NETWORK is not set in .env");
  }
  if (!process.env.NEAR_RPC) {
    throw new Error("NEAR_RPC is not set in .env");
  }
  if (!process.env.USDC_NEAR_ADDRESS) {
    throw new Error("USDC_NEAR_ADDRESS is not set in .env");
  }
  if (!process.env.USDC_ETH_ADDRESS) {
    throw new Error("USDC_ETH_ADDRESS is not set in .env");
  }

  // Validate private key format
  if (!process.env.USER_NEAR_PRIVATE_KEY.startsWith("ed25519:")) {
    throw new Error("USER_NEAR_PRIVATE_KEY must start with 'ed25519:'");
  }

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(
    process.env.USER_NEAR_PRIVATE_KEY as NearPrivateKey
  );
  await keyStore.setKey(
    process.env.NEAR_NETWORK,
    process.env.USER_NEAR_ACCOUNT_ID,
    keyPair
  );
  
  const config = {
    networkId: process.env.NEAR_NETWORK,
    keyStore,
    nodeUrl: process.env.NEAR_RPC,
    walletUrl: `https://testnet.mynearwallet.com/`,
    helperUrl: `https://helper.testnet.near.org`,
    explorerUrl: `https://testnet.nearblocks.io`,
  };
  
  const near = new Near(config);
  const account = await near.account(process.env.USER_NEAR_ACCOUNT_ID);

  // First, register the account with the USDC token contract
  console.log("Registering account with USDC token contract...");
  try {
    await account.functionCall({
      contractId: process.env.USDC_NEAR_ADDRESS,
      methodName: "storage_deposit",
      args: {
        account_id: process.env.USER_NEAR_ACCOUNT_ID,
        registration_only: true
      },
      gas: BigInt("30000000000000"), // 30 TGas
      attachedDeposit: BigInt("1250000000000000000000000"), // 0.00125 NEAR for storage
    });
    console.log("Account registered successfully!");
  } catch (error: any) {
    if (error.message && error.message.includes("already registered")) {
      console.log("Account is already registered.");
    } else {
      console.error("Registration failed:", error);
      throw error;
    }
  }

  // Check current balance
  console.log("Checking USDC balance...");
  let balance = "0";
  try {
    balance = await account.viewFunction({
      contractId: process.env.USDC_NEAR_ADDRESS,
      methodName: "ft_balance_of",
      args: { account_id: process.env.USER_NEAR_ACCOUNT_ID }
    });
    console.log(`Current USDC balance: ${balance}`);
  } catch (error) {
    console.log("Could not check balance:", error);
  }

  // If balance is 0, try to mint some test tokens (this may only work on fake/test contracts)
  if (balance === "0") {
    console.log("Balance is 0, attempting to mint test tokens...");
    try {
      await account.functionCall({
        contractId: process.env.USDC_NEAR_ADDRESS,
        methodName: "mint",
        args: {
          account_id: process.env.USER_NEAR_ACCOUNT_ID,
          amount: "1000000000" // 1000 USDC (6 decimals)
        },
        gas: BigInt("30000000000000"), // 30 TGas
        attachedDeposit: BigInt("0"),
      });
      console.log("Test tokens minted successfully!");
      
      // Check balance again
      balance = await account.viewFunction({
        contractId: process.env.USDC_NEAR_ADDRESS,
        methodName: "ft_balance_of",
        args: { account_id: process.env.USER_NEAR_ACCOUNT_ID }
      });
      console.log(`New USDC balance after minting: ${balance}`);
    } catch (error: any) {
      console.log("Could not mint test tokens (this may be expected if not a test contract):", error.message);
    }
  }

  // Also register the escrow account as a recipient
  const escrowAccountId = "escrow-contract.fayefaye2.testnet"; // Use the new deployed escrow contract
  console.log(`Registering escrow account ${escrowAccountId} with USDC token contract...`);
  try {
    await account.functionCall({
      contractId: process.env.USDC_NEAR_ADDRESS,
      methodName: "storage_deposit",
      args: {
        account_id: escrowAccountId,
        registration_only: true
      },
      gas: BigInt("30000000000000"), // 30 TGas
      attachedDeposit: BigInt("1250000000000000000000000"), // 0.00125 NEAR for storage
    });
    console.log("Escrow account registered successfully!");
  } catch (error: any) {
    if (error.message && error.message.includes("already registered")) {
      console.log("Escrow account is already registered.");
    } else {
      console.error("Escrow account registration failed:", error.message);
      // Don't throw here as the escrow might still work if it handles registration differently
    }
  }

  const secret = "mysecret"; // In practice, generate randomly in frontend
  const hashlock = ethers.sha256(ethers.toUtf8Bytes(secret)).slice(2); // hex without 0x

  const amount = "1"; // 0.000001 USDC (6 decimals) - very small amount for testing
  const msg = JSON.stringify({
    hashlock,
    timelock: 86400, // 1 day in seconds
    dest_chain: "ethereum",
    dest_user: "0xYourEthAddressHere", // User's Eth address
    min_return: "1000000", // Min USDC on Eth
    output_token: process.env.USDC_ETH_ADDRESS,
  });

  const tx = await account.functionCall({
    contractId: process.env.USDC_NEAR_ADDRESS,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: "escrow-contract.fayefaye2.testnet", // Use the new deployed escrow contract
      amount,
      msg,
    },
    gas: BigInt("300000000000000"), // 300 TGas
    attachedDeposit: BigInt("1"), // 1 yoctoNEAR
  });

  console.log(
    "Lock created on NEAR. Tx hash (token transfer):",
    tx.transaction.hash
  );
  // For demo, assume escrow_id = 0; in practice, query logs or get_last_id
  console.log("Escrow ID: 0 (query get_escrow to confirm)");
}

createLockOnNear().catch(console.error);
