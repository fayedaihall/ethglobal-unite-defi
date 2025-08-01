import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
dotenv.config();

async function createResolverAccount() {
  const { keyStores, connect, KeyPair, utils } = nearAPI;
  const keyStore = new keyStores.InMemoryKeyStore();

  // Use the user account to create the resolver account
  const userKeyPair = KeyPair.fromString(
    process.env.USER_NEAR_PRIVATE_KEY! as any
  );
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.USER_NEAR_ACCOUNT_ID!,
    userKeyPair
  );

  // Generate a new key pair for the resolver account
  const resolverKeyPair = KeyPair.fromRandom("ed25519");
  await keyStore.setKey(
    process.env.NEAR_NETWORK!,
    process.env.RESOLVER_NEAR_ACCOUNT_ID!,
    resolverKeyPair
  );

  const config = {
    networkId: process.env.NEAR_NETWORK!,
    keyStore,
    nodeUrl: process.env.NEAR_RPC!,
  };

  const near = await connect(config);
  const userAccount = await near.account(process.env.USER_NEAR_ACCOUNT_ID!);

  try {
    // Create the resolver account as a subaccount under the user account

    await userAccount.createAccount(
      process.env.RESOLVER_NEAR_ACCOUNT_ID!,
      resolverKeyPair.getPublicKey(),
      BigInt(utils.format.parseNearAmount("5")!) // 5 NEAR for account creation
    );

    console.log(
      `✅ Successfully created resolver account: ${process.env
        .RESOLVER_NEAR_ACCOUNT_ID!}`
    );
    console.log(`🔑 Public key: ${resolverKeyPair.getPublicKey()}`);
    console.log(`🔑 Private key: ${resolverKeyPair.toString()}`);

    // Update the .env file with the new private key
    console.log(
      `\n⚠️  Please update your .env file with the new resolver private key:`
    );
    console.log(`RESOLVER_NEAR_PRIVATE_KEY=${resolverKeyPair.toString()}`);
  } catch (error: any) {
    if (error.type === "AccountAlreadyExists") {
      console.log(
        `Resolver account ${process.env
          .RESOLVER_NEAR_ACCOUNT_ID!} already exists.`
      );
    } else {
      console.error("Error creating resolver account:", error);
    }
  }
}

createResolverAccount().catch(console.error);
