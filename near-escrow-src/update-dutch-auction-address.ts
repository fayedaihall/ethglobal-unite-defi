import * as fs from "fs";
import * as path from "path";

// Manual Dutch Auction contract address (you can replace this with the actual deployed address)
const DUTCH_AUCTION_ADDRESS = "0x1234567890123456789012345678901234567890"; // Replace with actual address

console.log("🔧 Updating Dutch Auction contract address...");
console.log(`📝 New address: ${DUTCH_AUCTION_ADDRESS}`);

// Update frontend/config/networks.ts
const networksPath = path.join(__dirname, "frontend/config/networks.ts");
if (fs.existsSync(networksPath)) {
  let content = fs.readFileSync(networksPath, "utf8");
  content = content.replace(
    /dutchAuction: "0x[^"]*"/,
    `dutchAuction: "${DUTCH_AUCTION_ADDRESS}"`
  );
  fs.writeFileSync(networksPath, content);
  console.log("✅ Updated frontend/config/networks.ts");
} else {
  console.log("❌ frontend/config/networks.ts not found");
}

// Update frontend/utils/contracts.ts
const contractsPath = path.join(__dirname, "frontend/utils/contracts.ts");
if (fs.existsSync(contractsPath)) {
  let content = fs.readFileSync(contractsPath, "utf8");
  content = content.replace(
    /"0x0000000000000000000000000000000000000000", \/\/ Mock address for testing/,
    `"${DUTCH_AUCTION_ADDRESS}", // Dutch Auction address (Sepolia)`
  );
  fs.writeFileSync(contractsPath, content);
  console.log("✅ Updated frontend/utils/contracts.ts");
} else {
  console.log("❌ frontend/utils/contracts.ts not found");
}

// Update deployment-betswap-ai.json
const deploymentPath = path.join(__dirname, "deployment-betswap-ai.json");
if (fs.existsSync(deploymentPath)) {
  let deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  deployment.dutchAuction = DUTCH_AUCTION_ADDRESS;
  deployment.lastUpdated = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("✅ Updated deployment-betswap-ai.json");
} else {
  console.log("❌ deployment-betswap-ai.json not found");
}

console.log("\n🎉 Dutch Auction address updated successfully!");
console.log("\n📋 To deploy the contract manually:");
console.log("1. Use a reliable RPC endpoint (like Infura or Alchemy)");
console.log("2. Ensure your account has sufficient ETH");
console.log(
  "3. Run: npx hardhat run scripts/deploy-dutch-auction.js --network sepolia"
);
console.log(
  "4. Update the DUTCH_AUCTION_ADDRESS variable in this script with the deployed address"
);
console.log("5. Run this script again to update the frontend");
