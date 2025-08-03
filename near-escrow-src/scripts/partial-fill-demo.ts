import { ethers } from "ethers";

interface PartialFillOrder {
  orderId: string;
  totalAmount: string;
  filledAmount: string;
  remainingAmount: string;
  fillPercentage: number;
  price: string;
  status: "active" | "partially_filled" | "completed" | "cancelled";
}

class PartialFillDemo {
  async demonstratePartialFill() {
    console.log("🔄 Partial Fill Dutch Auction Demonstration");
    console.log("=".repeat(60));

    // Demo 1: Large Order Partial Fill
    await this.demoLargeOrderPartialFill();

    // Demo 2: Multiple Small Fills
    await this.demoMultipleSmallFills();

    // Demo 3: Price Impact on Partial Fills
    await this.demoPriceImpactPartialFills();

    // Demo 4: Cross-Chain Partial Fill
    await this.demoCrossChainPartialFill();

    console.log("\n✅ Partial fill demonstration completed!");
  }

  private async demoLargeOrderPartialFill() {
    console.log("\n📊 Demo 1: Large Order Partial Fill");
    console.log("-".repeat(50));

    const orderId = ethers.keccak256(
      ethers.toUtf8Bytes("large_order_partial_fill")
    );
    const totalAmount = "10000000"; // 10M BET tokens
    const startPrice = "1000000000000000000"; // 1 ETH
    const endPrice = "500000000000000000"; // 0.5 ETH
    const duration = 3600; // 1 hour

    console.log("📋 Large Order Details:");
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Total Amount: ${totalAmount} BET tokens`);
    console.log(`   Start Price: ${ethers.formatEther(startPrice)} ETH`);
    console.log(`   End Price: ${ethers.formatEther(endPrice)} ETH`);
    console.log(`   Duration: ${duration} seconds (1 hour)`);

    // Simulate partial fills over time
    console.log("\n🔄 Simulating partial fills...");

    const fills = [
      { time: "0:15", amount: "2000000", price: "0.95", percentage: 20 },
      { time: "0:30", amount: "1500000", price: "0.85", percentage: 35 },
      { time: "0:45", amount: "1000000", price: "0.75", percentage: 45 },
      { time: "1:00", amount: "500000", price: "0.65", percentage: 50 },
    ];

    let totalFilled = 0;
    for (const fill of fills) {
      totalFilled += parseInt(fill.amount);
      const remaining = parseInt(totalAmount) - totalFilled;
      const fillPercentage = (totalFilled / parseInt(totalAmount)) * 100;

      console.log(`\n⏰ Time: ${fill.time}`);
      console.log(`   Fill Amount: ${fill.amount} BET tokens`);
      console.log(`   Fill Price: ${fill.price} ETH`);
      console.log(
        `   Total Filled: ${totalFilled.toLocaleString()} BET tokens`
      );
      console.log(`   Remaining: ${remaining.toLocaleString()} BET tokens`);
      console.log(`   Fill Progress: ${fillPercentage.toFixed(1)}%`);
      console.log(
        `   Status: ${
          fillPercentage === 100 ? "Completed" : "Partially Filled"
        }`
      );
    }

    console.log("\n✅ Large order partial fill simulation completed!");
  }

  private async demoMultipleSmallFills() {
    console.log("\n🔄 Demo 2: Multiple Small Fills");
    console.log("-".repeat(50));

    const orderId = ethers.keccak256(
      ethers.toUtf8Bytes("multiple_small_fills")
    );
    const totalAmount = "5000000"; // 5M BET tokens
    const startPrice = "800000000000000000"; // 0.8 ETH
    const endPrice = "400000000000000000"; // 0.4 ETH

    console.log("📋 Order Details:");
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Total Amount: ${totalAmount} BET tokens`);
    console.log(`   Start Price: ${ethers.formatEther(startPrice)} ETH`);
    console.log(`   End Price: ${ethers.formatEther(endPrice)} ETH`);

    // Simulate multiple small fills
    console.log("\n🔄 Simulating multiple small fills...");

    const smallFills = [
      { buyer: "0x1234...", amount: "500000", price: "0.75", time: "0:05" },
      { buyer: "0x5678...", amount: "300000", price: "0.72", time: "0:12" },
      { buyer: "0x9abc...", amount: "400000", price: "0.68", time: "0:18" },
      { buyer: "0xdef0...", amount: "200000", price: "0.65", time: "0:25" },
      { buyer: "0x1111...", amount: "600000", price: "0.62", time: "0:32" },
      { buyer: "0x2222...", amount: "800000", price: "0.58", time: "0:40" },
      { buyer: "0x3333...", amount: "700000", price: "0.55", time: "0:48" },
      { buyer: "0x4444...", amount: "500000", price: "0.52", time: "0:55" },
      { buyer: "0x5555...", amount: "400000", price: "0.48", time: "1:02" },
      { buyer: "0x6666...", amount: "600000", price: "0.45", time: "1:10" },
    ];

    let totalFilled = 0;
    let totalValue = 0;

    for (const fill of smallFills) {
      totalFilled += parseInt(fill.amount);
      const fillValue = (parseInt(fill.amount) * parseFloat(fill.price)) / 1e18;
      totalValue += fillValue;
      const remaining = parseInt(totalAmount) - totalFilled;
      const fillPercentage = (totalFilled / parseInt(totalAmount)) * 100;

      console.log(`\n💰 Fill at ${fill.time}:`);
      console.log(`   Buyer: ${fill.buyer}`);
      console.log(
        `   Amount: ${parseInt(fill.amount).toLocaleString()} BET tokens`
      );
      console.log(`   Price: ${fill.price} ETH`);
      console.log(`   Value: ${fillValue.toFixed(6)} ETH`);
      console.log(`   Progress: ${fillPercentage.toFixed(1)}%`);
      console.log(`   Remaining: ${remaining.toLocaleString()} BET tokens`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total Filled: ${totalFilled.toLocaleString()} BET tokens`);
    console.log(`   Total Value: ${totalValue.toFixed(6)} ETH`);
    console.log(
      `   Average Price: ${((totalValue * 1e18) / totalFilled).toFixed(
        2
      )} wei per token`
    );
    console.log(
      `   Fill Percentage: ${(
        (totalFilled / parseInt(totalAmount)) *
        100
      ).toFixed(1)}%`
    );

    console.log("\n✅ Multiple small fills simulation completed!");
  }

  private async demoPriceImpactPartialFills() {
    console.log("\n📈 Demo 3: Price Impact on Partial Fills");
    console.log("-".repeat(50));

    const orderId = ethers.keccak256(
      ethers.toUtf8Bytes("price_impact_partial_fills")
    );
    const totalAmount = "8000000"; // 8M BET tokens
    const startPrice = "1000000000000000000"; // 1 ETH
    const endPrice = "400000000000000000"; // 0.4 ETH

    console.log("📋 Order Details:");
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Total Amount: ${totalAmount} BET tokens`);
    console.log(`   Start Price: ${ethers.formatEther(startPrice)} ETH`);
    console.log(`   End Price: ${ethers.formatEther(endPrice)} ETH`);

    console.log("\n🔄 Simulating price impact on partial fills...");

    const fillsWithImpact = [
      { time: "0:10", amount: "1000000", price: "0.95", impact: "Low" },
      { time: "0:20", amount: "2000000", price: "0.88", impact: "Medium" },
      { time: "0:30", amount: "1500000", price: "0.82", impact: "Medium" },
      { time: "0:40", amount: "2500000", price: "0.75", impact: "High" },
      { time: "0:50", amount: "1000000", price: "0.68", impact: "Low" },
    ];

    let totalFilled = 0;
    let cumulativeImpact = 0;

    for (const fill of fillsWithImpact) {
      totalFilled += parseInt(fill.amount);
      const remaining = parseInt(totalAmount) - totalFilled;
      const fillPercentage = (totalFilled / parseInt(totalAmount)) * 100;

      // Calculate price impact
      const theoreticalPrice = parseFloat(fill.price);
      const actualPrice =
        theoreticalPrice *
        (1 - (parseInt(fill.amount) / parseInt(totalAmount)) * 0.1);
      cumulativeImpact +=
        ((theoreticalPrice - actualPrice) / theoreticalPrice) * 100;

      console.log(`\n⏰ Time: ${fill.time}`);
      console.log(
        `   Fill Amount: ${parseInt(fill.amount).toLocaleString()} BET tokens`
      );
      console.log(`   Theoretical Price: ${fill.price} ETH`);
      console.log(`   Actual Price: ${actualPrice.toFixed(3)} ETH`);
      console.log(`   Price Impact: ${fill.impact}`);
      console.log(`   Progress: ${fillPercentage.toFixed(1)}%`);
      console.log(`   Remaining: ${remaining.toLocaleString()} BET tokens`);
    }

    console.log(`\n📊 Price Impact Summary:`);
    console.log(
      `   Average Price Impact: ${(
        cumulativeImpact / fillsWithImpact.length
      ).toFixed(2)}%`
    );
    console.log(`   Total Filled: ${totalFilled.toLocaleString()} BET tokens`);
    console.log(
      `   Final Fill Percentage: ${(
        (totalFilled / parseInt(totalAmount)) *
        100
      ).toFixed(1)}%`
    );

    console.log("\n✅ Price impact simulation completed!");
  }

  private async demoCrossChainPartialFill() {
    console.log("\n🌉 Demo 4: Cross-Chain Partial Fill");
    console.log("-".repeat(50));

    const orderId = ethers.keccak256(
      ethers.toUtf8Bytes("cross_chain_partial_fill")
    );
    const totalAmount = "12000000"; // 12M BET tokens
    const startPrice = "1200000000000000000"; // 1.2 ETH
    const endPrice = "600000000000000000"; // 0.6 ETH

    console.log("📋 Cross-Chain Order Details:");
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Total Amount: ${totalAmount} BET tokens`);
    console.log(`   Start Price: ${ethers.formatEther(startPrice)} ETH`);
    console.log(`   End Price: ${ethers.formatEther(endPrice)} ETH`);
    console.log(`   Source Chain: Ethereum`);
    console.log(`   Target Chain: NEAR`);

    console.log("\n🔄 Simulating cross-chain partial fills...");

    const crossChainFills = [
      {
        time: "0:05",
        amount: "3000000",
        price: "1.15",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x1111...",
        nearAccount: "buyer1.testnet",
      },
      {
        time: "0:15",
        amount: "2500000",
        price: "1.05",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x2222...",
        nearAccount: "buyer2.testnet",
      },
      {
        time: "0:25",
        amount: "2000000",
        price: "0.95",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x3333...",
        nearAccount: "buyer3.testnet",
      },
      {
        time: "0:35",
        amount: "1500000",
        price: "0.85",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x4444...",
        nearAccount: "buyer4.testnet",
      },
      {
        time: "0:45",
        amount: "1000000",
        price: "0.75",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x5555...",
        nearAccount: "buyer5.testnet",
      },
      {
        time: "0:55",
        amount: "2000000",
        price: "0.65",
        sourceChain: "Ethereum",
        targetChain: "NEAR",
        buyer: "0x6666...",
        nearAccount: "buyer6.testnet",
      },
    ];

    let totalFilled = 0;
    let totalValue = 0;

    for (const fill of crossChainFills) {
      totalFilled += parseInt(fill.amount);
      const fillValue = (parseInt(fill.amount) * parseFloat(fill.price)) / 1e18;
      totalValue += fillValue;
      const remaining = parseInt(totalAmount) - totalFilled;
      const fillPercentage = (totalFilled / parseInt(totalAmount)) * 100;

      console.log(`\n🌉 Cross-Chain Fill at ${fill.time}:`);
      console.log(`   Buyer: ${fill.buyer} (${fill.sourceChain})`);
      console.log(`   NEAR Account: ${fill.nearAccount}`);
      console.log(
        `   Amount: ${parseInt(fill.amount).toLocaleString()} BET tokens`
      );
      console.log(`   Price: ${fill.price} ETH`);
      console.log(`   Value: ${fillValue.toFixed(6)} ETH`);
      console.log(`   Progress: ${fillPercentage.toFixed(1)}%`);
      console.log(`   Remaining: ${remaining.toLocaleString()} BET tokens`);
      console.log(`   HTLC Status: ✅ Locked on both chains`);
    }

    console.log(`\n📊 Cross-Chain Summary:`);
    console.log(`   Total Filled: ${totalFilled.toLocaleString()} BET tokens`);
    console.log(`   Total Value: ${totalValue.toFixed(6)} ETH`);
    console.log(
      `   Fill Percentage: ${(
        (totalFilled / parseInt(totalAmount)) *
        100
      ).toFixed(1)}%`
    );
    console.log(`   Cross-Chain Success Rate: 100%`);
    console.log(`   HTLC Escrow Status: ✅ All fills secured`);

    console.log("\n✅ Cross-chain partial fill simulation completed!");
  }

  async showPartialFillBenefits() {
    console.log("\n🚀 Partial Fill Benefits");
    console.log("=".repeat(40));

    console.log("✅ **Improved Liquidity**");
    console.log("   - Large orders can be filled gradually");
    console.log("   - Reduces market impact of large trades");
    console.log("   - Enables better price discovery");

    console.log("\n✅ **Better Execution**");
    console.log("   - Orders don't need to be all-or-nothing");
    console.log("   - Partial fills reduce slippage");
    console.log("   - More flexible order management");

    console.log("\n✅ **Cross-Chain Efficiency**");
    console.log("   - Large cross-chain swaps can be batched");
    console.log("   - Reduces gas costs through batching");
    console.log("   - Better capital efficiency");

    console.log("\n✅ **Risk Management**");
    console.log("   - Reduces exposure to price volatility");
    console.log("   - Allows for dynamic order adjustment");
    console.log("   - Better control over execution timing");
  }

  async demonstratePartialFillMechanics() {
    console.log("\n🔧 Partial Fill Mechanics");
    console.log("=".repeat(40));

    console.log("📊 **Order Management**");
    console.log("   1. Large order is split into smaller chunks");
    console.log("   2. Each chunk can be filled independently");
    console.log("   3. Price updates based on remaining amount");
    console.log("   4. Order status tracks fill progress");

    console.log("\n🌉 **Cross-Chain Coordination**");
    console.log("   1. HTLC locks created for each partial fill");
    console.log("   2. Cross-chain bridge coordinates transfers");
    console.log("   3. Partial fills settle independently");
    console.log("   4. Order completion when all fills settle");

    console.log("\n⏰ **Time-Based Execution**");
    console.log("   1. Dutch auction price decays over time");
    console.log("   2. Partial fills execute at current price");
    console.log("   3. Remaining order adjusts to new price");
    console.log("   4. Order expires if not fully filled");
  }
}

async function main() {
  const demo = new PartialFillDemo();

  try {
    await demo.demonstratePartialFill();
    await demo.showPartialFillBenefits();
    await demo.demonstratePartialFillMechanics();
  } catch (error: any) {
    console.error("❌ Demo failed:", error.message);
  }
}

main().catch(console.error);
