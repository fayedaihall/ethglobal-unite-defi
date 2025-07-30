import * as nearAPI from "near-api-js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function resolverFill(
  escrowId: number,
  fillAmount: string,
  hashlock: string,
  userEthAddress: string
) {
  // Step 4.1: Register as resolver on Near
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(process.env.RESOLVER_NEAR_PRIVATE_KEY!);
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    "resolver." + process.env.NEAR_NETWORK!,
    keyPair
  );
  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };
  const near = await connect(config);
  const nearAccount = await near.account(
    "resolver." + process.env.NEAR_NETWORK!
  );
  const registerTx = await nearAccount.functionCall({
    contractId: "escrow." + process.env.NEAR_NETWORK!,
    methodName: "register_resolver",
    args: { id: escrowId },
    gas: "30000000000000",
  });
  console.log(
    "Registered as resolver on Near. Tx:",
    registerTx.transaction.hash
  );

  // Step 4.2: Create lock on Eth (deposit USDC)
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(
    process.env.ETH_PRIVATE_KEY || process.env.RESOLVER_ETH_PRIVATE_KEY!,
    provider
  );
  const htlcAbi = [
    /* HTLC ABI here */
  ];
  const htlc = new ethers.Contract(
    "your_deployed_htlc_address_here",
    htlcAbi,
    wallet
  );
  const usdc = new ethers.Contract(
    process.env.USDC_ETH_ADDRESS!,
    ["function approve(address,uint256) returns(bool)"],
    wallet
  );
  await usdc.approve(htlc.address, fillAmount);
  const id = ethers.keccak256(ethers.toUtf8Bytes(escrowId.toString())); // Unique ID
  const timelock = 7200; // 2 hours
  const createTx = await htlc.createLock(
    id,
    userEthAddress,
    process.env.USDC_ETH_ADDRESS,
    fillAmount,
    "0x" + hashlock,
    timelock
  );
  await createTx.wait();
  console.log(
    "Lock created on Eth. Tx (token transfer to escrow):",
    createTx.hash
  );
}

// Example call (get hashlock from query, assume from auction service)
resolverFill(0, "1000000", "hashlock_from_order", "0xuser");
