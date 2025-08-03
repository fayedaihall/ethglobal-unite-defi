import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.sepolia" });

async function updatePrivateKey() {
  console.log("🔧 Updating private key for account with ETH...");

  const targetAccount = "0x3aa1fe004111a6EA3180ccf557D8260F36b717d1";

  console.log(`📋 Target account: ${targetAccount}`);
  console.log("\n💡 To update the private key:");
  console.log("1. Find the private key for account:", targetAccount);
  console.log("2. Update ETH_PRIVATE_KEY in .env.sepolia");
  console.log("3. Run the setup script again");

  console.log("\n🔍 Current ETH_PRIVATE_KEY in .env.sepolia:");
  console.log(
    "ETH_PRIVATE_KEY=0x89791bdb4e6ce25349c979710af8c6f7088f4d92136342f218169539801dbb42"
  );

  console.log("\n📝 To update, run:");
  console.log(
    `sed -i '' 's|ETH_PRIVATE_KEY=0x89791bdb4e6ce25349c979710af8c6f7088f4d92136342f218169539801dbb42|ETH_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE|' .env.sepolia`
  );

  console.log("\n🎯 Then run:");
  console.log("npx ts-node setup-usdc-for-account.ts");
}

updatePrivateKey().catch(console.error);
