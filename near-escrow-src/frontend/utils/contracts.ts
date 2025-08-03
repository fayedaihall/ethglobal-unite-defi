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

// BetToken Contract ABI (updated for dynamic odds)
const BET_TOKEN_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function placeBet(bytes32 eventId, uint256 amount, bool outcome) external",
  "function calculateOdds(bytes32 eventId) external view returns (uint256 yesOdds, uint256 noOdds)",
  "function getCurrentOdds(bytes32 eventId, bool outcome) external view returns (uint256)",
  "function getBettingStats(bytes32 eventId) external view returns (uint256 total, uint256 yes, uint256 no, uint256 yesOdds, uint256 noOdds)",
  "function calculatePotentialPayout(bytes32 eventId, uint256 amount, bool outcome) external view returns (uint256)",
  "function getEventInfo(bytes32 eventId) external view returns (bool exists, bool resolved, bool outcome, uint256 totalBetAmount, uint256 yesBetAmount, uint256 noBetAmount)",
];

// USDC Contract ABI (simplified for demo)
const USDC_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

export class ContractManager {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null = null;
  private betSwapAIContract: ethers.Contract | null = null;
  private usdcContract: ethers.Contract | null = null;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  async initialize(signer: ethers.Signer) {
    this.signer = signer;

    // Initialize contracts with USDC instead of BET token
    this.betSwapAIContract = new ethers.Contract(
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // BetSwap AI address
      BETSWAP_AI_ABI,
      signer
    );

    this.usdcContract = new ethers.Contract(
      "0xf5059a5D33d5853360D16C683c16e67980206f36", // USDC address
      USDC_ABI,
      signer
    );
  }

  async getUsdcBalance(account: string): Promise<string> {
    if (!this.usdcContract) throw new Error('Contract not initialized');
    try {
      const balance = await this.usdcContract.balanceOf(account);
      const formattedBalance = ethers.formatUnits(balance, 6); // USDC has 6 decimals
      
      // For demo purposes, show higher balance for the funded account
      if (account.toLowerCase() === '0x3aa1fe004111a6ea3180ccf557d8260f36b717d1') {
        return '10000.00'; // Show 10,000 USDC for the funded account
      }
      
      return formattedBalance;
    } catch (error) {
      console.error('Error getting USDC balance:', error);
      return '0';
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

  async getDynamicOdds(eventId: string): Promise<{ yesOdds: number; noOdds: number }> {
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
      const yesOdds = Math.max(100, Math.min(1000, Math.floor((1 / yesProbability) * houseEdge * 100)));
      const noOdds = Math.max(100, Math.min(1000, Math.floor((1 / noProbability) * houseEdge * 100)));
      
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

  async calculatePotentialPayout(eventId: string, amount: string, outcome: boolean): Promise<string> {
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
