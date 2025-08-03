import { ethers } from "ethers";

// BetSwap AI Contract ABI (simplified for demo)
const BETSWAP_AI_ABI = [
  "function placeBet(uint256 eventId, uint256 amount, bool outcome) external",
  "function placeCrossChainBet(uint256 eventId, uint256 amount, bool outcome, string memory nearAccountId) external",
  "function createBetEvent(string memory title, string memory description, uint256 endTime) external",
  "function getBetEvent(uint256 eventId) external view returns (string memory, string memory, uint256, uint256, bool, bool)",
  "function resolveBetWithAI(uint256 eventId, uint256 confidence) external",
  "function calculateOdds(bytes32 eventId) external view returns (uint256 yesOdds, uint256 noOdds)",
  "function getCurrentOdds(bytes32 eventId, bool outcome) external view returns (uint256)",
  "function getBettingStats(bytes32 eventId) external view returns (uint256 total, uint256 yes, uint256 no, uint256 yesOdds, uint256 noOdds)",
  "function calculatePotentialPayout(bytes32 eventId, uint256 amount, bool outcome) external view returns (uint256)",
];

// USDC Contract ABI (updated for full functionality)
const USDC_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
];

export class ContractManager {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null = null;
  public betSwapAIContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  async initialize(signer: ethers.Signer) {
    this.signer = signer;

    // Initialize contracts with USDC instead of BET token
    this.betSwapAIContract = new ethers.Contract(
      "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", // BetSwap AI address (Local)
      BETSWAP_AI_ABI,
      signer
    );

    this.usdcContract = new ethers.Contract(
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC address (Sepolia)
      USDC_ABI,
      signer
    );
  }

  async getUsdcBalance(account: string): Promise<string> {
    if (!this.usdcContract) throw new Error("Contract not initialized");
    try {
      console.log(`🔍 Checking USDC balance for account: ${account}`);
      console.log(`🏦 USDC Contract: ${await this.usdcContract.getAddress()}`);

      // Debug provider and network info
      const network = await this.provider.getNetwork();
      console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

      // Check if we're on the right network (Sepolia = 11155111)
      if (network.chainId !== BigInt(11155111)) {
        console.log(
          `⚠️ Warning: Not on Sepolia network! Current: ${network.name} (${network.chainId})`
        );
      }

      console.log(`📞 Calling balanceOf for account: ${account}`);

      // Add more detailed error handling
      let balance;
      try {
        // Try using the provider directly first
        console.log(`🔧 Trying direct provider call...`);
        const data = this.usdcContract.interface.encodeFunctionData(
          "balanceOf",
          [account]
        );
        console.log(`📦 Encoded data: ${data}`);

        const result = await this.provider.call({
          to: await this.usdcContract.getAddress(),
          data: data,
        });
        console.log(`📦 Raw result: ${result}`);

        if (result === "0x") {
          console.log(`⚠️ Empty result, trying contract method...`);
          balance = await this.usdcContract.balanceOf(account);
        } else {
          balance = this.usdcContract.interface.decodeFunctionResult(
            "balanceOf",
            result
          )[0];
        }

        console.log(`✅ balanceOf call successful`);
      } catch (balanceError) {
        console.error(`❌ balanceOf call failed:`, balanceError);
        throw balanceError;
      }

      const formattedBalance = ethers.formatUnits(balance, 6); // USDC has 6 decimals

      console.log(`💰 Raw balance: ${balance.toString()}`);
      console.log(`💰 Formatted balance: ${formattedBalance} USDC`);

      // Return the actual balance from the contract
      return formattedBalance;
    } catch (error) {
      console.error("Error getting USDC balance:", error);
      return "0";
    }
  }

  async getUsdcBalanceOnNear(account: string): Promise<string> {
    // For demo purposes, simulate USDC balance on NEAR
    // In a real implementation, this would query the NEAR USDC contract
    try {
      // Simulate USDC balance on NEAR network
      const mockBalance = Math.floor(Math.random() * 10000) + 1000; // Random balance between 1000-11000
      return (mockBalance / 100).toFixed(2); // Format as USDC with 2 decimal places
    } catch (error) {
      console.error("Error getting NEAR USDC balance:", error);
      return "0.00";
    }
  }

  async getDynamicOdds(
    eventId: string
  ): Promise<{ yesOdds: number; noOdds: number }> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    try {
      // For demo purposes, simulate dynamic odds based on betting volume
      const baseOdds = 150; // 1.50x base odds
      const volatility = Math.random() * 100; // Random volatility

      // Simulate market sentiment (more bets on one side = lower odds for that side)
      const yesBets = Math.floor(Math.random() * 1000) + 100;
      const noBets = Math.floor(Math.random() * 1000) + 100;
      const totalBets = yesBets + noBets;

      const yesProbability = yesBets / totalBets;
      const noProbability = noBets / totalBets;

      // Calculate odds with house edge (0.5%)
      const houseEdge = 0.995;
      const yesOdds = Math.max(
        100,
        Math.min(1000, Math.floor((1 / yesProbability) * houseEdge * 100))
      );
      const noOdds = Math.max(
        100,
        Math.min(1000, Math.floor((1 / noProbability) * houseEdge * 100))
      );

      return { yesOdds, noOdds };
    } catch (error) {
      console.error("Error getting dynamic odds:", error);
      return { yesOdds: 150, noOdds: 150 }; // Default odds
    }
  }

  async getBettingStats(eventId: string): Promise<{
    total: number;
    yes: number;
    no: number;
    yesOdds: number;
    noOdds: number;
  }> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    try {
      // For demo purposes, simulate betting statistics
      const total = Math.floor(Math.random() * 10000) + 1000;
      const yes = Math.floor(Math.random() * total);
      const no = total - yes;

      const { yesOdds, noOdds } = await this.getDynamicOdds(eventId);

      return {
        total,
        yes,
        no,
        yesOdds,
        noOdds,
      };
    } catch (error) {
      console.error("Error getting betting stats:", error);
      return {
        total: 0,
        yes: 0,
        no: 0,
        yesOdds: 150,
        noOdds: 150,
      };
    }
  }

  async calculatePotentialPayout(
    eventId: string,
    amount: string,
    outcome: boolean
  ): Promise<string> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    try {
      const { yesOdds, noOdds } = await this.getDynamicOdds(eventId);
      const odds = outcome ? yesOdds : noOdds;
      const amountNum = parseFloat(amount);
      const payout = (amountNum * odds) / 100;

      return payout.toFixed(2);
    } catch (error) {
      console.error("Error calculating potential payout:", error);
      return "0.00";
    }
  }

  async placeBet(
    eventId: number,
    amount: string,
    outcome: boolean
  ): Promise<any> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    return await this.betSwapAIContract.placeBet(eventId, amountWei, outcome);
  }

  async placeCrossChainBet(
    eventId: number,
    amount: string,
    outcome: boolean,
    nearAccountId: string
  ): Promise<any> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    return await this.betSwapAIContract.placeCrossChainBet(
      eventId,
      amountWei,
      outcome,
      nearAccountId
    );
  }

  async approveUsdcTokens(spender: string, amount: string): Promise<any> {
    if (!this.usdcContract) throw new Error("Contract not initialized");

    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    return await this.usdcContract.approve(spender, amountWei);
  }

  async createBetEvent(
    title: string,
    description: string,
    endTime: number
  ): Promise<any> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    return await this.betSwapAIContract.createBetEvent(
      title,
      description,
      endTime
    );
  }

  async getBetEvent(eventId: number): Promise<any> {
    if (!this.betSwapAIContract) throw new Error("Contract not initialized");

    return await this.betSwapAIContract.getBetEvent(eventId);
  }
}

export const createContractManager = (
  provider: ethers.Provider
): ContractManager => {
  return new ContractManager(provider);
};
