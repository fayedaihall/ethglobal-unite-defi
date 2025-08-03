import { ethers } from "ethers";

async function testMetaMaskRPC() {
  console.log("🧪 Testing with MetaMask-style RPC...\n");

  try {
    // Use a public Sepolia RPC (similar to what MetaMask might use)
    const provider = new ethers.JsonRpcProvider(
      "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"
    );

    // USDC contract address
    const usdcAddress = "0x04C89607413713Ec9775E14b954286519d836FEf";

    // Minimal ABI
    const USDC_ABI = [
      "function balanceOf(address owner) external view returns (uint256)",
    ];

    const usdcContract = new ethers.Contract(usdcAddress, USDC_ABI, provider);

    // Test account
    const account = "0x62482a678d5F8D6D789654040E6BB8077215CCa8";

    console.log(`🔍 Testing with account: ${account}`);
    console.log(`🏦 USDC Contract: ${usdcAddress}`);

    // Get network info
    const network = await provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Check if contract exists
    const code = await provider.getCode(usdcAddress);
    console.log(`📏 Contract code length: ${code.length} characters`);

    if (code === "0x") {
      console.log("❌ Contract does not exist at this address on this RPC!");
      return;
    }

    // Try the balanceOf call
    console.log("📞 Calling balanceOf...");
    const balance = await usdcContract.balanceOf(account);
    const formattedBalance = ethers.formatUnits(balance, 6);

    console.log(`💰 Raw balance: ${balance.toString()}`);
    console.log(`💰 Formatted balance: ${formattedBalance} USDC`);

    console.log("✅ Contract call successful with MetaMask-style RPC!");
  } catch (error) {
    console.error("❌ Error with MetaMask-style RPC:", error);
  }
}

// Run the test
testMetaMaskRPC().catch(console.error);
