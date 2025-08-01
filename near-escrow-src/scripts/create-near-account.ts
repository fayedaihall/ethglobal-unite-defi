import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
dotenv.config();

async function createEscrowAccount() {
  const { keyStores, connect, KeyPair, utils } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  
  // Use the user account to create the escrow account
  const userKeyPair = KeyPair.fromString(process.env.USER_NEAR_PRIVATE_KEY! as any);
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.USER_NEAR_ACCOUNT_ID!,
    userKeyPair
  );

  // Generate a new key pair for the escrow account
  const escrowKeyPair = KeyPair.fromRandom('ed25519');
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.ESCROW_NEAR_ACCOUNT_ID!,
    escrowKeyPair
  );

  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };

  const near = await connect(config);
  const userAccount = await near.account(process.env.USER_NEAR_ACCOUNT_ID!);

  try {
    // Create the escrow account as a subaccount under the user account
    
    await userAccount.createAccount(
      process.env.ESCROW_NEAR_ACCOUNT_ID!,
      escrowKeyPair.getPublicKey(),
      BigInt(utils.format.parseNearAmount("5")!) // 5 NEAR for account creation and deployment
    );

    console.log(`✅ Successfully created account: ${process.env.ESCROW_NEAR_ACCOUNT_ID!}`);
    console.log(`🔑 Public key: ${escrowKeyPair.getPublicKey()}`);
    console.log(`🔑 Private key: ${escrowKeyPair.toString()}`);
    
    // Update the .env file with the new private key
    console.log(`\n⚠️  Please update your .env file with the new private key:`);
    console.log(`NEAR_PRIVATE_KEY=${escrowKeyPair.toString()}`);
    
  } catch (error: any) {
    if (error.type === 'AccountAlreadyExists') {
      console.log(`Account ${process.env.ESCROW_NEAR_ACCOUNT_ID!} already exists.`);
    } else {
      console.error('Error creating account:', error);
    }
  }
}

createEscrowAccount().catch(console.error);
