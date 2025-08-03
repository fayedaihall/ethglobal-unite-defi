import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
import { ethers, parseUnits } from "ethers";
import * as crypto from "crypto";

dotenv.config();

type NearPrivateKey = `ed25519:${string}`;

async function createLockOnNear(amountHuman: string) {
  const envFile =
    process.env.NODE_ENV === "production" ? ".env.mainnet" : ".env.testnet";
  dotenv.config({ path: envFile });

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

  // Convert amount (USDC: 6 decimals)
  const decimals = 6;
  let amount: string;
  try {
    amount = parseUnits(amountHuman, decimals).toString();
    if (parseUnits(amountHuman, decimals) <= 0n) {
      throw new Error("Amount must be positive");
    }
  } catch (error) {
    throw new Error(`Invalid amount: ${amountHuman}. Must be a valid number.`);
  }
  console.log(`Amount (raw): ${amount} (human: ${amountHuman} USDC)`);

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
    walletUrl: process.env.NEAR_WALLET_URL,
    helperUrl: process.env.NEAR_HELPER_URL,
    explorerUrl: process.env.NEAR_EXPLORER_URL,
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
        registration_only: true,
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
      args: { account_id: process.env.USER_NEAR_ACCOUNT_ID },
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
          amount: "1000000000", // 1000 USDC (6 decimals)
        },
        gas: BigInt("30000000000000"), // 30 TGas
        attachedDeposit: BigInt("0"),
      });
      console.log("Test tokens minted successfully!");

      // Check balance again
      balance = await account.viewFunction({
        contractId: process.env.USDC_NEAR_ADDRESS,
        methodName: "ft_balance_of",
        args: { account_id: process.env.USER_NEAR_ACCOUNT_ID },
      });
      console.log(`New USDC balance after minting: ${balance}`);
    } catch (error: any) {
      console.log(
        "Could not mint test tokens (this may be expected if not a test contract):",
        error.message
      );
    }
  }

  // Also register the escrow account as a recipient
  const escrowAccountId = process.env.ESCROW_NEAR_ACCOUNT_ID;
  if (!escrowAccountId) {
    throw new Error("ESCROW_NEAR_ACCOUNT_ID is not set in .env");
  }
  console.log(
    `Registering escrow account ${escrowAccountId} with USDC token contract...`
  );
  try {
    await account.functionCall({
      contractId: process.env.USDC_NEAR_ADDRESS,
      methodName: "storage_deposit",
      args: {
        account_id: escrowAccountId,
        registration_only: true,
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

  // const secret = "mysecret"; // In practice, generate randomly in frontend
  const secret = crypto.randomBytes(32);
  const secretHex = secret.toString("hex");
  const hashlock = ethers.sha256(secret).slice(2); // hex without 0x
  console.log(`Generated secret: ${secretHex}`);
  console.log(`Hashlock: ${hashlock}`);

  const msg = JSON.stringify({
    hashlock,
    timelock: 86400, // 1 day in seconds
    dest_chain: "ethereum",
    dest_user: process.env.USER_ETH_ADDRESS, // User's Eth address
    min_return: amount, // Min USDC on Eth
    output_token: process.env.USDC_ETH_ADDRESS,
  });

  const tx = await account.functionCall({
    contractId: process.env.USDC_NEAR_ADDRESS,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: escrowAccountId,
      amount,
      msg,
    },
    gas: BigInt("300000000000000"), // 300 TGas
    attachedDeposit: BigInt("1"), // 1 yoctoNEAR
  });

  // Parse escrow ID from transaction logs
  let escrowId: number | null = null;

  // Look through all receipts and their logs to find the escrow creation log
  const receipts = tx.receipts_outcome || [];
  for (const receipt of receipts) {
    if (receipt.outcome && receipt.outcome.logs) {
      for (const log of receipt.outcome.logs) {
        const match = log.match(/Escrow created: (\d+)/);
        if (match) {
          escrowId = Number(match[1]);
          break;
        }
      }
    }
    if (escrowId !== null) break;
  }

  if (escrowId === null) {
    throw new Error("Could not find escrow ID in transaction logs");
  }

  console.log(`Escrow ID: ${escrowId}`);

  console.log(
    "Lock created on NEAR. Tx hash (token transfer):",
    tx.transaction.hash
  );
  console.log(`Escrow ID: ${escrowId}`);

  return { escrowId, secretHex };
}

// createLockOnNear("0.000001").catch(console.error);

const amountHuman = process.argv[2] || process.env.DEFAULT_SWAP_AMOUNT || "1";
createLockOnNear(amountHuman)
  .then(({ escrowId, secretHex }) => {
    console.log(
      `Use escrowId: ${escrowId} and secret: ${secretHex} in resolver-complete.ts`
    );
  })
  .catch(console.error);
