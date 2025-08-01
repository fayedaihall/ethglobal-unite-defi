import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
dotenv.config();

async function addKeyToEscrowAccount() {
  const { keyStores, connect, KeyPair } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();
  
  // Use the user account to add a key to the escrow account
  const userKeyPair = KeyPair.fromString(process.env.USER_NEAR_PRIVATE_KEY! as any);
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.USER_NEAR_ACCOUNT_ID!,
    userKeyPair
  );

  // Generate a new key pair for the escrow account
  const escrowKeyPair = KeyPair.fromRandom('ed25519');

  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };

  const near = await connect(config);
  const userAccount = await near.account(process.env.USER_NEAR_ACCOUNT_ID!);

  try {
    // Add a full access key to the escrow account
    await userAccount.functionCall({
      contractId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      methodName: 'add_key',
      args: {
        public_key: escrowKeyPair.getPublicKey().toString(),
        permission: 'FullAccess'
      },
      gas: BigInt("30000000000000"),
    });

    console.log(`✅ Successfully added key to account: ${process.env.ESCROW_NEAR_ACCOUNT_ID!}`);
    console.log(`🔑 Public key: ${escrowKeyPair.getPublicKey()}`);
    console.log(`🔑 Private key: ${escrowKeyPair.toString()}`);
    
    // Update the .env file with the new private key
    console.log(`\n⚠️  Please update your .env file with the new private key:`);
    console.log(`NEAR_PRIVATE_KEY=${escrowKeyPair.toString()}`);
    
  } catch (error: any) {
    console.error('Error adding key to account:', error);
    
    // Alternative approach: try to add key using AddKey action directly
    try {
      console.log('Trying alternative approach with AddKey action...');
      const actions = [
        nearAPI.transactions.addKey(
          escrowKeyPair.getPublicKey(),
          nearAPI.transactions.fullAccessKey()
        )
      ];
      
      await userAccount.signAndSendTransaction({
        receiverId: process.env.ESCROW_NEAR_ACCOUNT_ID!,
        actions
      });
      
      console.log(`✅ Successfully added key using AddKey action`);
      console.log(`🔑 Public key: ${escrowKeyPair.getPublicKey()}`);
      console.log(`🔑 Private key: ${escrowKeyPair.toString()}`);
      console.log(`\n⚠️  Please update your .env file with the new private key:`);
      console.log(`NEAR_PRIVATE_KEY=${escrowKeyPair.toString()}`);
      
    } catch (altError: any) {
      console.error('Alternative approach also failed:', altError);
    }
  }
}

addKeyToEscrowAccount().catch(console.error);
