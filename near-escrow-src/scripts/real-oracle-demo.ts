import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { OracleIntegration } from "../oracle-integration.ts";

// Load environment variables
dotenv.config({ path: ".env.sepolia" });

async function demonstrateRealOracles() {
  console.log("🔮 Real Oracle Integration Demo\n");

  try {
    // Demo 1: Sports Oracle (Chainlink)
    console.log("🏈 Demo 1: Sports Oracle (Chainlink)");
    console.log("=====================================");

    const sportsOracle = new OracleIntegration("chainlink");
    const sportsData = await sportsOracle.getSportsData(
      "manchester_united_vs_liverpool"
    );
    const sportsAnalysis = await sportsOracle.analyzeWithAI(
      sportsData,
      "sports"
    );

    console.log(`📊 Oracle Data: ${JSON.stringify(sportsData.data, null, 2)}`);
    console.log(`🤖 AI Analysis: ${sportsAnalysis.reasoning}`);
    console.log(
      `📈 Outcome: ${sportsAnalysis.outcome ? "Team A Wins" : "Team B Wins"}`
    );
    console.log(`🎯 Confidence: ${sportsAnalysis.confidence}%\n`);

    // Demo 2: Crypto Oracle (Pyth)
    console.log("💰 Demo 2: Crypto Oracle (Pyth)");
    console.log("================================");

    const cryptoOracle = new OracleIntegration("pyth");
    const cryptoData = await cryptoOracle.getCryptoData("bitcoin");
    const cryptoAnalysis = await cryptoOracle.analyzeWithAI(
      cryptoData,
      "crypto"
    );

    console.log(`📊 Oracle Data: ${JSON.stringify(cryptoData.data, null, 2)}`);
    console.log(`🤖 AI Analysis: ${cryptoAnalysis.reasoning}`);
    console.log(
      `📈 Outcome: ${cryptoAnalysis.outcome ? "Price Up" : "Price Down"}`
    );
    console.log(`🎯 Confidence: ${cryptoAnalysis.confidence}%\n`);

    // Demo 3: Weather Oracle (OpenWeather)
    console.log("🌤️ Demo 3: Weather Oracle (OpenWeather)");
    console.log("========================================");

    const weatherOracle = new OracleIntegration("openweather");
    const weatherData = await weatherOracle.getWeatherData("london");
    const weatherAnalysis = await weatherOracle.analyzeWithAI(
      weatherData,
      "weather"
    );

    console.log(`📊 Oracle Data: ${JSON.stringify(weatherData.data, null, 2)}`);
    console.log(`🤖 AI Analysis: ${weatherAnalysis.reasoning}`);
    console.log(
      `📈 Outcome: ${weatherAnalysis.outcome ? "Warm Day" : "Cold Day"}`
    );
    console.log(`🎯 Confidence: ${weatherAnalysis.confidence}%\n`);

    // Demo 4: Multiple Oracle Comparison
    console.log("🔄 Demo 4: Multiple Oracle Comparison");
    console.log("=====================================");

    const eventId = "arsenal_vs_chelsea";
    const oracleServices = ["chainlink", "pyth", "sportsradar"];

    for (const service of oracleServices) {
      try {
        const oracle = new OracleIntegration(service);
        const data = await oracle.getSportsData(eventId);
        const analysis = await oracle.analyzeWithAI(data, "sports");

        console.log(`📊 ${service.toUpperCase()} Oracle:`);
        console.log(
          `   Score: ${data.data.teamA} ${data.data.scoreA} - ${data.data.scoreB} ${data.data.teamB}`
        );
        console.log(
          `   Outcome: ${analysis.outcome ? "Team A Wins" : "Team B Wins"}`
        );
        console.log(`   Confidence: ${analysis.confidence}%\n`);
      } catch (error) {
        console.log(
          `❌ ${service.toUpperCase()} Oracle: Error - ${error.message}\n`
        );
      }
    }

    console.log("✅ Real Oracle Demo Complete!");
    console.log("\n📋 Summary:");
    console.log("- Sports events use sports oracles (Chainlink, SportsRadar)");
    console.log("- Crypto events use price oracles (Pyth, Alpha Vantage)");
    console.log("- Weather events use weather oracles (OpenWeather)");
    console.log("- AI analyzes real data to make predictions");
    console.log("- Multiple oracles can be compared for consensus");
  } catch (error) {
    console.error("❌ Demo failed:", error);
  }
}

// Run the demo
demonstrateRealOracles().catch(console.error);
