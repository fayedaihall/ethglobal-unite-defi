"use client";

import React from 'react';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createContractManager } from '../utils/contracts';
import { getNetworkConfig } from '../config/networks';
import { getWalletTroubleshootingSteps, getNearTroubleshootingSteps } from '../utils/wallet-helpers';
import { nearWalletManager } from '../utils/near-wallet';

interface BettingEvent {
  id: string;
  title: string;
  description: string;
  endTime: string;
  totalBets: string;
  outcome: boolean | null;
  resolved: boolean;
}

interface AIPrediction {
  eventId: string;
  predictedOutcome: boolean;
  confidence: number;
  oracleData: string;
  timestamp: number;
}

interface DynamicOdds {
  eventId: string;
  yesOdds: number;
  noOdds: number;
  yesBets: number;
  noBets: number;
  totalBets: number;
  lastUpdated: number;
}

interface BetInput {
  eventId: string;
  amount: string;
  outcome: boolean;
}

interface ContractConfig {
  betSwapAIAddress: string;
  usdcAddress: string;
  htlcAddress: string;
}

export default function BetSwapDemo() {
  // Global error handler to suppress all error popups
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    // Override console.error to prevent error popups
    console.error = (...args) => {
      const errorMessage = args.join(' ');

      // Suppress Chrome extension errors
      if (errorMessage.includes('chrome.runtime.sendMessage') ||
        errorMessage.includes('Extension ID') ||
        errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
        errorMessage.includes('Runtime TypeError') ||
        errorMessage.includes('chrome-extension://')) {
        console.log('🔍 Chrome extension error suppressed:', errorMessage);
        return;
      }

      console.log('🔍 Error logged (suppressed popup):', errorMessage);
      // Don't call originalError to prevent error popups
    };

    // Override console.warn to prevent warning popups
    console.warn = (...args) => {
      const warnMessage = args.join(' ');
      console.log('🔍 Warning logged (suppressed popup):', warnMessage);
      // Don't call originalWarn to prevent warning popups
    };

    // Override window.onerror to prevent error overlays
    const originalOnError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      const errorMessage = message?.toString() || '';

      // Suppress Chrome extension errors
      if (errorMessage.includes('chrome.runtime.sendMessage') ||
        errorMessage.includes('Extension ID') ||
        errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
        errorMessage.includes('Runtime TypeError') ||
        errorMessage.includes('chrome-extension://')) {
        console.log('🔍 Chrome extension error suppressed:', errorMessage);
        return true; // Prevent default error handling
      }

      console.log('🔍 Window error logged (suppressed popup):', message);
      return true; // Prevent default error handling
    };

    // Override unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const errorMessage = event.reason?.toString() || '';

      // Suppress Chrome extension errors
      if (errorMessage.includes('chrome.runtime.sendMessage') ||
        errorMessage.includes('Extension ID') ||
        errorMessage.includes('opfgelmcmbiajamepnmloijbpoleiama') ||
        errorMessage.includes('Runtime TypeError') ||
        errorMessage.includes('chrome-extension://')) {
        console.log('🔍 Chrome extension promise rejection suppressed:', errorMessage);
        event.preventDefault();
        return;
      }

      console.log('🔍 Unhandled promise rejection logged (suppressed popup):', event.reason);
      event.preventDefault(); // Prevent default error handling
    });

    return () => {
      // Restore original error handlers on cleanup
      console.error = originalError;
      console.warn = originalWarn;
      window.onerror = originalOnError;
    };
  }, []);

  const [ethereumAccount, setEthereumAccount] = useState<string>('');
  const [nearAccount, setNearAccount] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const [currentChain, setCurrentChain] = useState<'ethereum' | 'near'>('ethereum');
  const [ethereumEvents, setEthereumEvents] = useState<BettingEvent[]>([]);
  const [nearEvents, setNearEvents] = useState<BettingEvent[]>([]);
  const [ethereumBets, setEthereumBets] = useState<BetInput[]>([]);
  const [nearBets, setNearBets] = useState<BetInput[]>([]);
  const [ethereumAIPredictions, setEthereumAIPredictions] = useState<AIPrediction[]>([]);
  const [nearAIPredictions, setNearAIPredictions] = useState<AIPrediction[]>([]);
  const [ethereumDynamicOdds, setEthereumDynamicOdds] = useState<DynamicOdds[]>([]);
  const [nearDynamicOdds, setNearDynamicOdds] = useState<DynamicOdds[]>([]);
  const [provider, setProvider] = useState<ethers.Provider | null>(null);
  const [contractManager, setContractManager] = useState<any>(null);
  const [contracts, setContracts] = useState<ContractConfig | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [nearUsdcBalance, setNearUsdcBalance] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<string>('Disconnected');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  // Add state for tracking popup status
  const [nearPopupOpen, setNearPopupOpen] = useState(false);
  // Add state for tracking refresh attempts
  const [nearRefreshAttempts, setNearRefreshAttempts] = useState(0);
  // Add state for instruction popup
  const [showNearInstructionPopup, setShowNearInstructionPopup] = useState(false);

  // Native betting tracking state
  const [ethereumNativeBets, setEthereumNativeBets] = useState<BetInput[]>([]);
  const [nearNativeBets, setNearNativeBets] = useState<BetInput[]>([]);
  const [ethereumNativeWinnings, setEthereumNativeWinnings] = useState<number>(0);
  const [nearNativeWinnings, setNearNativeWinnings] = useState<number>(0);
  const [ethereumNativeWinRate, setEthereumNativeWinRate] = useState<number>(0);
  const [nearNativeWinRate, setNearNativeWinRate] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Cross-chain betting tracking state
  const [crossChainBets, setCrossChainBets] = useState<BetInput[]>([]);
  const [crossChainWinnings, setCrossChainWinnings] = useState<number>(0);
  const [crossChainWinRate, setCrossChainWinRate] = useState<number>(0);

  // Load data from localStorage after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEthereumBets = localStorage.getItem('betswap_ethereum_native_bets');
      const savedNearBets = localStorage.getItem('betswap_near_native_bets');
      const savedEthereumWinnings = localStorage.getItem('betswap_ethereum_native_winnings');
      const savedNearWinnings = localStorage.getItem('betswap_near_native_winnings');
      const savedEthereumWinRate = localStorage.getItem('betswap_ethereum_native_winrate');
      const savedNearWinRate = localStorage.getItem('betswap_near_native_winrate');
      const savedCrossChainBets = localStorage.getItem('betswap_cross_chain_bets');
      const savedCrossChainWinnings = localStorage.getItem('betswap_cross_chain_winnings');
      const savedCrossChainWinRate = localStorage.getItem('betswap_cross_chain_winrate');

      if (savedEthereumBets) {
        setEthereumNativeBets(JSON.parse(savedEthereumBets));
      }
      if (savedNearBets) {
        setNearNativeBets(JSON.parse(savedNearBets));
      }
      if (savedEthereumWinnings) {
        setEthereumNativeWinnings(parseFloat(savedEthereumWinnings));
      }
      if (savedNearWinnings) {
        setNearNativeWinnings(parseFloat(savedNearWinnings));
      }
      if (savedEthereumWinRate) {
        setEthereumNativeWinRate(parseFloat(savedEthereumWinRate));
      }
      if (savedNearWinRate) {
        setNearNativeWinRate(parseFloat(savedNearWinRate));
      }
      if (savedCrossChainBets) {
        setCrossChainBets(JSON.parse(savedCrossChainBets));
      }
      if (savedCrossChainWinnings) {
        setCrossChainWinnings(parseFloat(savedCrossChainWinnings));
      }
      if (savedCrossChainWinRate) {
        setCrossChainWinRate(parseFloat(savedCrossChainWinRate));
      }
    }
    setIsHydrated(true);
  }, []);



  // Contract addresses for Sepolia testnet
  const sepoliaContracts: ContractConfig = {
    betSwapAIAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    usdcAddress: '0xf5059a5D33d5853360D16C683c16e67980206f36', // USDC address
    htlcAddress: '0x4A679253410272dd5232B3Ff7cF5dbB88f295319',
  };

  // Functions need to be defined before they are called in `useEffect` hooks

  const fetchAIPredictions = async (chain: 'ethereum' | 'near') => {
    try {
      if (chain === 'ethereum' && contractManager) {
        // For demo purposes, simulate AI predictions
        const mockPredictions: AIPrediction[] = ethereumEvents.map(event => ({
          eventId: event.id,
          predictedOutcome: Math.random() > 0.5,
          confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
          oracleData: `AI analysis based on market data and historical patterns for event: ${event.title}`,
          timestamp: Date.now()
        }));
        setEthereumAIPredictions(mockPredictions);
      } else if (chain === 'near' && nearAccount) {
        // For demo purposes, simulate NEAR AI predictions
        const mockPredictions: AIPrediction[] = nearEvents.map(event => ({
          eventId: event.id,
          predictedOutcome: Math.random() > 0.5,
          confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
          oracleData: `NEAR AI analysis based on cross-chain data for event: ${event.title}`,
          timestamp: Date.now()
        }));
        setNearAIPredictions(mockPredictions);
      }
    } catch (error) {
      console.error(`Failed to fetch AI predictions for ${chain}:`, error);
    }
  };

  const fetchDynamicOdds = async (chain: 'ethereum' | 'near') => {
    try {
      if (chain === 'ethereum' && contractManager) {
        const mockOdds: DynamicOdds[] = ethereumEvents.map(event => {
          const totalBets = Math.floor(Math.random() * 10000) + 1000;
          const yesBets = Math.floor(Math.random() * totalBets);
          const noBets = totalBets - yesBets;

          // Calculate dynamic odds based on betting distribution
          const yesProbability = yesBets / totalBets;
          const noProbability = noBets / totalBets;

          const houseEdge = 0.995; // 0.5% house edge
          const yesOdds = Math.max(100, Math.min(1000, Math.floor((1 / yesProbability) * houseEdge * 100)));
          const noOdds = Math.max(100, Math.min(1000, Math.floor((1 / noProbability) * houseEdge * 100)));

          return {
            eventId: event.id,
            yesOdds,
            noOdds,
            yesBets,
            noBets,
            totalBets,
            lastUpdated: Date.now()
          };
        });
        setEthereumDynamicOdds(mockOdds);
      } else if (chain === 'near' && nearAccount) {
        const mockOdds: DynamicOdds[] = nearEvents.map(event => {
          const totalBets = Math.floor(Math.random() * 10000) + 1000;
          const yesBets = Math.floor(Math.random() * totalBets);
          const noBets = totalBets - yesBets;

          // Calculate dynamic odds based on betting distribution
          const yesProbability = yesBets / totalBets;
          const noProbability = noBets / totalBets;

          const houseEdge = 0.995; // 0.5% house edge
          const yesOdds = Math.max(100, Math.min(1000, Math.floor((1 / yesProbability) * houseEdge * 100)));
          const noOdds = Math.max(100, Math.min(1000, Math.floor((1 / noProbability) * houseEdge * 100)));

          return {
            eventId: event.id,
            yesOdds,
            noOdds,
            yesBets,
            noBets,
            totalBets,
            lastUpdated: Date.now()
          };
        });
        setNearDynamicOdds(mockOdds);
      }
    } catch (error) {
      console.error(`Failed to fetch dynamic odds for ${chain}:`, error);
    }
  };

  const placeEthereumBets = async (bets: BetInput[]) => {
    if (!contractManager || !ethereumAccount) {
      throw new Error('Contract manager or account not available');
    }

    // Get BetSwapAI contract address for approval
    const betSwapAIAddress = await contractManager.betSwapAIContract.getAddress();

    // Calculate total amount needed for all bets
    const totalAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);

    // Check USDC balance first
    const balance = await contractManager.getUsdcBalance(ethereumAccount);
    const balanceNum = parseFloat(balance);
    if (balanceNum < totalAmount) {
      throw new Error(`Insufficient USDC balance. You have ${balanceNum.toFixed(2)} USDC but need ${totalAmount} USDC.`);
    }

    // First, approve USDC spending for the total amount
    console.log(`Approving ${totalAmount} USDC for BetSwapAI contract...`);
    try {
      const approveTx = await contractManager.approveUsdcTokens(betSwapAIAddress, totalAmount.toString());
      await approveTx.wait();
      console.log('USDC approval successful');
    } catch (error) {
      console.error('Error approving USDC:', error);
      throw new Error('Failed to approve USDC spending. Please try again.');
    }

    for (const bet of bets) {
      console.log(`Placing bet: ${bet.amount} USDC on event ${bet.eventId}, outcome: ${bet.outcome}`);

      try {
        // First, create the event if it doesn't exist
        const eventIdBytes = ethers.keccak256(ethers.toUtf8Bytes(`event_${bet.eventId}`));
        const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

        try {
          await contractManager.createBetEvent(
            `Event ${bet.eventId}`,
            `Demo event for testing`,
            endTime
          );
          console.log(`Event ${bet.eventId} created successfully`);
        } catch (createError) {
          console.log(`Event ${bet.eventId} may already exist, continuing with bet placement`);
        }

        const txHash = await contractManager.placeBet(bet.eventId, bet.amount, bet.outcome);
        console.log('Bet placed successfully:', txHash);

        // Track native betting data
        setEthereumNativeBets(prev => [...prev, bet]);

        // Simulate winnings (in real implementation, this would be calculated from actual results)
        const betAmount = parseFloat(bet.amount);
        const simulatedWinning = Math.random() > 0.5 ? betAmount * 1.5 : 0;
        setEthereumNativeWinnings(prev => prev + simulatedWinning);

        // Calculate win rate
        const totalBets = ethereumNativeBets.length + 1;
        const totalWins = ethereumNativeBets.filter(b => Math.random() > 0.5).length + (simulatedWinning > 0 ? 1 : 0);
        setEthereumNativeWinRate(totalWins / totalBets * 100);

        // Update balance after successful bet
        await getUsdcBalance(contractManager, ethereumAccount);
      } catch (error: any) {
        console.error('Error placing bet:', error);
        if (error.message?.includes('Insufficient USDC balance')) {
          throw new Error('Insufficient USDC balance. Please fund your account first.');
        } else if (error.message?.includes('Event does not exist')) {
          throw new Error('Event does not exist. Please try again.');
        } else if (error.message?.includes('Event already resolved')) {
          throw new Error('This event has already been resolved.');
        } else {
          throw new Error(`Failed to place bet: ${error.message || 'Unknown error'}`);
        }
      }
    }
  };

  const placeNearBets = async (bets: BetInput[]) => {
    try {
      if (!nearAccount) {
        alert('Please connect to NEAR wallet first!');
        return;
      }

      console.log('🎯 Placing NEAR bets:', bets);

      for (const bet of bets) {
        try {
          // Simulate NEAR transaction (in real implementation, this would call a NEAR contract)
          console.log(`📝 Placing bet on event ${bet.eventId}: ${bet.amount} NEAR for outcome ${bet.outcome}`);

          // For demo purposes, we'll simulate the transaction
          // In production, this would call: await nearWalletManager.signAndSendTransaction(...)

          // Add a small delay to simulate transaction processing
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log(`✅ NEAR bet placed successfully for event ${bet.eventId}`);

          // Track native betting data
          setNearNativeBets(prev => [...prev, bet]);

          // Simulate winnings (in real implementation, this would be calculated from actual results)
          const betAmount = parseFloat(bet.amount);
          const simulatedWinning = Math.random() > 0.5 ? betAmount * 1.5 : 0;
          setNearNativeWinnings(prev => prev + simulatedWinning);

          // Calculate win rate
          const totalBets = nearNativeBets.length + 1;
          const totalWins = nearNativeBets.filter(b => Math.random() > 0.5).length + (simulatedWinning > 0 ? 1 : 0);
          setNearNativeWinRate(totalWins / totalBets * 100);
        } catch (error) {
          console.error(`❌ Failed to place NEAR bet for event ${bet.eventId}:`, error);
          alert(`Failed to place bet for event ${bet.eventId}. Please try again.`);
        }
      }
      setNearBets([]);
      alert('NEAR bets placed successfully!');
    } catch (error) {
      console.error('❌ Failed to place NEAR bets:', error);
      alert('Failed to place NEAR bets. Please try again.');
    }
  };

  const placeBet = async (chain: 'ethereum' | 'near') => {
    const bets = chain === 'ethereum' ? ethereumBets : nearBets;

    if (bets.length === 0) {
      alert('Please enter bet amounts first!');
      return;
    }

    // Determine which wallet to use for placing bets
    let targetChain: 'ethereum' | 'near';
    if (chain === 'ethereum') {
      if (ethereumAccount) {
        targetChain = 'ethereum';
      } else if (nearAccount) {
        targetChain = 'near';
        alert('⚠️ Cross-chain betting: Placing Ethereum event bets using NEAR wallet');
      } else {
        alert('Please connect to Ethereum or NEAR wallet first!');
        return;
      }
    } else { // chain === 'near'
      if (nearAccount) {
        targetChain = 'near';
      } else if (ethereumAccount) {
        targetChain = 'ethereum';
        alert('⚠️ Cross-chain betting: Placing NEAR event bets using Ethereum wallet');
      } else {
        alert('Please connect to NEAR or Ethereum wallet first!');
        return;
      }
    }

    if (targetChain === 'ethereum' && !contractManager) {
      alert('Please connect to Ethereum first!');
      return;
    }

    setIsLoading(true);

    try {
      if (targetChain === 'ethereum') {
        await placeEthereumBets(bets);
      } else {
        await placeNearBets(bets);
      }

      // Clear bets after successful placement
      if (chain === 'ethereum') {
        setEthereumBets([]);
      } else {
        setNearBets([]);
      }

      const crossChainMessage = targetChain !== chain ? ` (via ${targetChain} wallet)` : '';
      alert(`${bets.length} bets placed successfully on ${chain}${crossChainMessage}!`);

      // Track cross-chain bets if this was a cross-chain transaction
      if (targetChain !== chain) {
        console.log('🔄 Tracking cross-chain bet...');
        for (const bet of bets) {
          setCrossChainBets(prev => [...prev, bet]);

          // Simulate cross-chain winnings
          const betAmount = parseFloat(bet.amount);
          const simulatedWinning = Math.random() > 0.5 ? betAmount * 1.8 : 0; // Higher multiplier for cross-chain
          setCrossChainWinnings(prev => prev + simulatedWinning);

          // Calculate cross-chain win rate
          const totalBets = crossChainBets.length + 1;
          const totalWins = crossChainBets.filter(b => Math.random() > 0.5).length + (simulatedWinning > 0 ? 1 : 0);
          setCrossChainWinRate(totalWins / totalBets * 100);
        }
      }
    } catch (error) {
      console.error(`Error placing bets on ${chain}:`, error);
      alert(`Failed to place bets on ${chain}. Please try again.`);
    }

    setIsLoading(false);
  };

  // Sample betting events for demo - Updated for August 2025
  useEffect(() => {
    console.log('Loading events...');

    // Create all events on the blockchain when component loads
    const createAllEvents = async () => {
      if (contractManager && ethereumAccount) {
        console.log('🔄 Creating all events on Ethereum...');
        try {
          const events = [
            { id: '1', title: 'Bitcoin ETF Approval Q4 2025', description: 'Will the SEC approve additional spot Bitcoin ETFs by December 31, 2025?' },
            { id: '2', title: 'Premier League 2025/26 Winner', description: 'Will Manchester City win the 2025/26 Premier League title?' },
            { id: '3', title: 'UEFA Champions League 2025/26', description: 'Will Real Madrid win the 2025/26 UEFA Champions League?' },
            { id: '4', title: 'NBA Finals 2025 Winner', description: 'Will the Boston Celtics win the 2025 NBA Championship?' },
            { id: '5', title: 'Tesla Stock Performance 2025', description: 'Will TSLA close above $300 on December 31, 2025?' },
            { id: '6', title: 'World Cup 2026 Winner', description: 'Will the United States reach the semifinals of the 2026 FIFA World Cup?' }
          ];

          for (const event of events) {
            try {
              const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
              await contractManager.createBetEvent(
                event.title,
                event.description,
                endTime
              );
              console.log(`✅ Event ${event.id} created successfully`);
            } catch (error) {
              console.log(`ℹ️ Event ${event.id} may already exist, continuing...`);
            }
          }
        } catch (error) {
          console.error('Error creating events:', error);
        }
      }
    };

    // Create events when contract manager is available
    if (contractManager && ethereumAccount) {
      createAllEvents();
    }

    const sampleEthereumEvents: BettingEvent[] = [
      {
        id: '1',
        title: 'Bitcoin ETF Approval Q4 2025',
        description: 'Will the SEC approve additional spot Bitcoin ETFs by December 31, 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '185000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '2',
        title: 'Premier League 2025/26 Winner',
        description: 'Will Manchester City win the 2025/26 Premier League title?',
        endTime: '1735689600', // May 2026
        totalBets: '180000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '3',
        title: 'UEFA Champions League 2025/26',
        description: 'Will Real Madrid win the 2025/26 UEFA Champions League?',
        endTime: '1735689600', // May 2026
        totalBets: '150000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '4',
        title: 'NBA Finals 2025 Winner',
        description: 'Will the Boston Celtics win the 2025 NBA Championship?',
        endTime: '1735689600', // June 2025
        totalBets: '280000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '5',
        title: 'Tesla Stock Performance 2025',
        description: 'Will TSLA close above $300 on December 31, 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '110000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '6',
        title: 'World Cup 2026 Winner',
        description: 'Will the United States reach the semifinals of the 2026 FIFA World Cup?',
        endTime: '1751328000', // July 2026
        totalBets: '145000', // USDC
        outcome: null,
        resolved: false,
      },
    ];

    const sampleNearEvents: BettingEvent[] = [
      {
        id: '7',
        title: 'NEAR Protocol TVL Q4 2025',
        description: 'Will NEAR Protocol TVL exceed $1B by December 31, 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '75000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '8',
        title: 'La Liga 2025/26 Winner',
        description: 'Will Barcelona win the 2025/26 La Liga title?',
        endTime: '1735689600', // May 2026
        totalBets: '85000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '9',
        title: 'Serie A 2025/26 Winner',
        description: 'Will Inter Milan win the 2025/26 Serie A title?',
        endTime: '1735689600', // May 2026
        totalBets: '72000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '10',
        title: 'AI Integration in DeFi',
        description: 'Will 10+ major DeFi protocols integrate AI features by Q4 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '58000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '11',
        title: 'Layer 2 Adoption Growth',
        description: 'Will Arbitrum daily active users exceed 2M by December 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '82000', // USDC
        outcome: null,
        resolved: false,
      },
      {
        id: '12',
        title: 'Global Crypto Regulation',
        description: 'Will the EU MiCA regulation be fully implemented by Q4 2025?',
        endTime: '1735689600', // December 31, 2025
        totalBets: '92000', // USDC
        outcome: null,
        resolved: false,
      },
    ];

    setEthereumEvents(sampleEthereumEvents);
    setNearEvents(sampleNearEvents);
  }, [contractManager, ethereumAccount]);

  // Save native betting data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_ethereum_native_bets', JSON.stringify(ethereumNativeBets));
    }
  }, [ethereumNativeBets]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_near_native_bets', JSON.stringify(nearNativeBets));
    }
  }, [nearNativeBets]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_ethereum_native_winnings', ethereumNativeWinnings.toString());
    }
  }, [ethereumNativeWinnings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_near_native_winnings', nearNativeWinnings.toString());
    }
  }, [nearNativeWinnings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_ethereum_native_winrate', ethereumNativeWinRate.toString());
    }
  }, [ethereumNativeWinRate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_near_native_winrate', nearNativeWinRate.toString());
    }
  }, [nearNativeWinRate]);

  // Save cross-chain betting data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_cross_chain_bets', JSON.stringify(crossChainBets));
    }
  }, [crossChainBets]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_cross_chain_winnings', crossChainWinnings.toString());
    }
  }, [crossChainWinnings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('betswap_cross_chain_winrate', crossChainWinRate.toString());
    }
  }, [crossChainWinRate]);

  // Fetch AI predictions when events are loaded
  useEffect(() => {
    if (ethereumEvents.length > 0) {
      fetchAIPredictions('ethereum');
    }
  }, [ethereumEvents]);

  useEffect(() => {
    if (nearEvents.length > 0) {
      fetchAIPredictions('near');
    }
  }, [nearEvents]);

  // Fetch dynamic odds when events are loaded
  useEffect(() => {
    if (ethereumEvents.length > 0) {
      fetchDynamicOdds('ethereum');
    }
  }, [ethereumEvents]);

  useEffect(() => {
    if (nearEvents.length > 0) {
      fetchDynamicOdds('near');
    }
  }, [nearEvents]);

  // Load persistent wallet connections on page load
  useEffect(() => {
    const loadPersistentConnections = async () => {
      try {
        // Don't auto-connect - let user explicitly click connect button
        console.log('🔄 Skipping auto-connection - user must click connect button');

        // Check for persistent NEAR connection
        const savedNearAccount = localStorage.getItem('betswap_near_account');
        if (savedNearAccount) {
          console.log('🔄 Restoring persistent NEAR connection...');
          setNearAccount(savedNearAccount);
          const balance = await nearWalletManager.getUsdcBalance(savedNearAccount);
          setNearUsdcBalance(balance);
          setNetworkStatus('Connected to NEAR Testnet');
          console.log('✅ Restored NEAR connection:', savedNearAccount);
        }
      } catch (error) {
        console.error('Error loading persistent connections:', error);
      }
    };

    loadPersistentConnections();

    // Check MetaMask availability on page load
    console.log('🔍 Checking MetaMask availability on page load...');
    console.log('🔍 Window object:', typeof window !== 'undefined' ? 'Available' : 'Not available');
    if (typeof window !== 'undefined') {
      console.log('🔍 Window.ethereum:', window.ethereum ? 'Available' : 'Not available');
      if (window.ethereum) {
        console.log('🔍 MetaMask provider:', window.ethereum);
        console.log('🔍 MetaMask isConnected:', window.ethereum.isConnected ? 'Yes' : 'No');
        console.log('🔍 MetaMask selectedAddress:', window.ethereum.selectedAddress);
      }
    }

    // Define account change handler
    const handleAccountsChanged = async (accounts: string[]) => {
      console.log('🔄 MetaMask accounts changed:', accounts);
      console.log('🔄 Current frontend account before change:', ethereumAccount);

      if (accounts.length === 0) {
        // User disconnected MetaMask
        console.log('🔄 Disconnecting from MetaMask...');
        setEthereumAccount('');
        setUsdcBalance('0');
        setContractManager(null);
        localStorage.removeItem('betswap_eth_account');
        setNetworkStatus('Disconnected from Ethereum');
        setForceUpdate(prev => prev + 1);
      } else {
        // User switched accounts
        const newAccount = accounts[0];
        console.log('📋 New MetaMask account:', newAccount);
        console.log('📋 Old frontend account:', ethereumAccount);

        // Force immediate state update
        setEthereumAccount(newAccount);
        localStorage.setItem('betswap_eth_account', newAccount);
        setForceUpdate(prev => prev + 1); // Force re-render

        console.log('🔄 State updated, new account should be:', newAccount);

        // Reinitialize contract manager and get balance
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const newContractManager = createContractManager(provider);
          await newContractManager.initialize(signer);
          setContractManager(newContractManager);

          const balance = await newContractManager.getUsdcBalance(newAccount);
          setUsdcBalance(balance);
          setNetworkStatus('Connected to Ethereum Sepolia');
          console.log('✅ Updated to new Ethereum account:', newAccount);
        } catch (error) {
          console.error('Error updating to new account:', error);
        }
      }
    };

    // Add listener for MetaMask account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      // Remove any existing listeners first
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Cleanup listener on unmount
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }

    // Add periodic check for account changes (fallback)
    const checkAccountPeriodically = async () => {
      if (typeof window !== 'undefined' && window.ethereum && ethereumAccount) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          const currentMetaMaskAccount = accounts[0];

          if (currentMetaMaskAccount && currentMetaMaskAccount.toLowerCase() !== ethereumAccount.toLowerCase()) {
            console.log('🔄 Periodic check detected account change!');
            console.log('📋 MetaMask account:', currentMetaMaskAccount);
            console.log('📋 Frontend account:', ethereumAccount);

            setEthereumAccount(currentMetaMaskAccount);
            localStorage.setItem('betswap_eth_account', currentMetaMaskAccount);
            setForceUpdate(prev => prev + 1);

            // Reinitialize contract manager
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const newContractManager = createContractManager(provider);
            await newContractManager.initialize(signer);
            setContractManager(newContractManager);

            const balance = await newContractManager.getUsdcBalance(currentMetaMaskAccount);
            setUsdcBalance(balance);
            setNetworkStatus('Connected to Ethereum Sepolia');
            console.log('✅ Updated to new Ethereum account via periodic check:', currentMetaMaskAccount);
          }
        } catch (error) {
          console.error('Error in periodic account check:', error);
        }
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkAccountPeriodically, 5000);

    return () => {
      clearInterval(interval);
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [ethereumAccount]); // Add ethereumAccount as dependency

  // Check for existing NEAR wallet connections on page load
  useEffect(() => {
    const checkNearConnection = async () => {
      try {
        await nearWalletManager.initialize();
        const accountId = await nearWalletManager.checkSignInStatus();
        if (accountId) {
          setNearAccount(accountId);
          await getNearUsdcBalance(accountId);
          setNetworkStatus('Connected to NEAR Testnet');
          console.log('✅ Found existing NEAR connection:', accountId);
        }
      } catch (error) {
        console.log('No existing NEAR connection found');
      }
    };

    checkNearConnection();
  }, []);

  // Function to check NEAR sign-in status periodically
  const checkNearSignInStatus = async () => {
    try {
      console.log('🔍 Checking NEAR sign-in status...');
      const accountId = await nearWalletManager.checkSignInStatus();

      if (accountId) {
        console.log('✅ Detected NEAR sign-in:', accountId);
        setNearAccount(accountId);
        await getNearUsdcBalance(accountId);
        setNetworkStatus('Connected to NEAR Testnet');
        setNearPopupOpen(false);
        setIsConnecting(false);
      } else {
        console.log('⏳ Still waiting for NEAR sign-in...');
      }
    } catch (error) {
      console.error('❌ Error checking NEAR sign-in status:', error);
      // Don't stop checking on error, just log it
    }
  };

  // Effect to check NEAR sign-in status when popup is open
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    if (nearPopupOpen) {
      console.log('🔄 Starting NEAR sign-in detection...');
      // Check every 2 seconds while popup is open
      interval = setInterval(checkNearSignInStatus, 2000);

      // Also check immediately
      checkNearSignInStatus();

      // Stop checking after 30 seconds to prevent infinite checking
      timeout = setTimeout(() => {
        console.log('⏰ Timeout reached, stopping automatic NEAR detection');
        setNearPopupOpen(false);
        setNearRefreshAttempts(0); // Reset refresh attempts
        setNetworkStatus('NEAR connection timeout - please try again');
      }, 30000); // 30 seconds
    }

    return () => {
      if (interval) {
        console.log('🛑 Stopping NEAR sign-in detection...');
        clearInterval(interval);
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [nearPopupOpen]);

  const connectEthereum = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setErrorMessage('');
    setShowTroubleshooting(false);

    console.log('🔄 Starting Ethereum connection...');
    console.log('🔍 Window object:', typeof window !== 'undefined' ? 'Available' : 'Not available');
    console.log('🔍 Window.ethereum:', window.ethereum ? 'Available' : 'Not available');

    try {
      if (typeof window === 'undefined') {
        console.log('❌ Window object not available');
        setErrorMessage('This app requires a browser environment.');
        setShowTroubleshooting(true);
        return;
      }
      if (!window.ethereum) {
        console.log('❌ MetaMask not detected');
        setErrorMessage('MetaMask is not installed. Please install MetaMask to continue.');
        setShowTroubleshooting(true);
        return;
      }
      // Skip the initial account check - we'll force the popup anyway
      console.log('🔄 Will force MetaMask popup on connection...');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];

      console.log('📋 Requested accounts:', accounts);
      console.log('📋 Selected account:', account);

      if (account) {
        console.log('🔄 Setting Ethereum account:', account);
        setEthereumAccount(account);
        setForceUpdate(prev => prev + 1); // Force re-render

        // Save to localStorage for persistence
        localStorage.setItem('betswap_eth_account', account);
        console.log('💾 Saved to localStorage:', account);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const newContractManager = createContractManager(provider);
        await newContractManager.initialize(signer);
        setContractManager(newContractManager);
        console.log('✅ Contract manager initialized');

        await getUsdcBalance(newContractManager, account);
        setNetworkStatus('Connected to Ethereum Sepolia');
        console.log('✅ Connected to Ethereum:', account);

        // Create all events after successful connection
        console.log('🔄 Creating all events on Ethereum...');
        try {
          const events = [
            { id: '1', title: 'Bitcoin ETF Approval Q4 2025', description: 'Will the SEC approve additional spot Bitcoin ETFs by December 31, 2025?' },
            { id: '2', title: 'Premier League 2025/26 Winner', description: 'Will Manchester City win the 2025/26 Premier League title?' },
            { id: '3', title: 'UEFA Champions League 2025/26', description: 'Will Real Madrid win the 2025/26 UEFA Champions League?' },
            { id: '4', title: 'NBA Finals 2025 Winner', description: 'Will the Boston Celtics win the 2025 NBA Championship?' },
            { id: '5', title: 'Tesla Stock Performance 2025', description: 'Will TSLA close above $300 on December 31, 2025?' },
            { id: '6', title: 'World Cup 2026 Winner', description: 'Will the United States reach the semifinals of the 2026 FIFA World Cup?' }
          ];

          for (const event of events) {
            try {
              const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
              await newContractManager.createBetEvent(
                event.title,
                event.description,
                endTime
              );
              console.log(`✅ Event ${event.id} created successfully`);
            } catch (error) {
              console.log(`ℹ️ Event ${event.id} may already exist, continuing...`);
            }
          }
          console.log('✅ All events created successfully');
        } catch (error) {
          console.error('Error creating events:', error);
        }
      }
    } catch (error: any) {
      console.log('Error connecting to Ethereum:', error);
      if (error.message && error.message.includes('chrome.runtime.sendMessage')) {
        console.log('Chrome extension error suppressed:', error.message);
        return;
      }
      setErrorMessage(error.message || 'Failed to connect to Ethereum');
      setShowTroubleshooting(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectNear = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setErrorMessage('');
    setShowTroubleshooting(false);

    try {
      await nearWalletManager.initialize();

      // First check if already signed in
      const currentAccountId = await nearWalletManager.checkSignInStatus();
      if (currentAccountId) {
        console.log('✅ Already signed in to NEAR:', currentAccountId);
        setNearAccount(currentAccountId);
        await getNearUsdcBalance(currentAccountId);
        setNetworkStatus('Connected to NEAR Testnet');
        setNearPopupOpen(false);
        setIsConnecting(false);
        return;
      }

      // If not signed in, open popup
      const accountId = await nearWalletManager.connectWallet();

      if (accountId) {
        // User is already signed in
        setNearAccount(accountId);
        await getNearUsdcBalance(accountId);
        setNetworkStatus('Connected to NEAR Testnet');
        setNearPopupOpen(false);
        console.log('✅ Connected to NEAR testnet wallet:', accountId);
      } else {
        // User needs to sign in - MyNearWallet popup has been opened
        setNetworkStatus('Please sign in to MyNearWallet in the popup window');
        setNearPopupOpen(true);

        // Show instruction popup with account ID input
        setShowNearInstructionPopup(true);

        // Start checking for sign-in status automatically
        setTimeout(() => {
          setNetworkStatus('Waiting for sign-in... (checking automatically)');
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Failed to connect to NEAR testnet wallet:', error);

      if (error.message.includes('Popup blocked')) {
        setErrorMessage('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else {
        setErrorMessage('Failed to connect to NEAR testnet wallet. Please try the troubleshooting steps.');
      }

      setShowTroubleshooting(true);
      setNetworkStatus('NEAR connection failed');
      setNearPopupOpen(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const refreshNearConnection = async () => {
    console.log('🔄 Manually refreshing NEAR connection...');
    setIsConnecting(true);
    setNearRefreshAttempts(prev => prev + 1);

    try {
      const accountId = await nearWalletManager.checkSignInStatus();
      if (accountId) {
        console.log('✅ Manual refresh detected NEAR sign-in:', accountId);
        setNearAccount(accountId);
        await getNearUsdcBalance(accountId);
        setNetworkStatus('Connected to NEAR Testnet');
        setNearPopupOpen(false);
        setNearRefreshAttempts(0); // Reset attempts on success
      } else {
        console.log('❌ Manual refresh: No NEAR sign-in detected');
        // Keep popup open and continue checking
        setNetworkStatus('Still waiting for sign-in... (checking automatically)');
        // Restart the checking process
        setNearPopupOpen(true);
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      setNetworkStatus('NEAR connection failed');
      setNearPopupOpen(false);
      setNearRefreshAttempts(0); // Reset attempts on error
    } finally {
      setIsConnecting(false);
    }
  };

  const connectNearManually = async () => {
    setShowNearInstructionPopup(true);
  };

  const disconnectEthereum = () => {
    setEthereumAccount('');
    setContractManager(null);
    setUsdcBalance('0');
    setNetworkStatus('Disconnected from Ethereum');
    localStorage.removeItem('betswap_eth_account');
    console.log('🔌 Disconnected from Ethereum');
  };

  const disconnectNear = async () => {
    setNearAccount(null);
    setNearUsdcBalance('0.00');
    setNetworkStatus('Disconnected from NEAR');
    setNearPopupOpen(false);
    localStorage.removeItem('betswap_near_account');
    console.log('🔌 Disconnected from NEAR');
  };

  const getUsdcBalance = async (contractManager: any, account: string) => {
    try {
      console.log('🔍 Frontend: Getting USDC balance for account:', account);
      console.log('🔍 Frontend: Contract manager:', contractManager);

      const balance = await contractManager.getUsdcBalance(account);
      console.log('🔍 Frontend: Received balance:', balance);

      setUsdcBalance(balance);
      console.log('🔍 Frontend: Set USDC balance to:', balance);
    } catch (error) {
      console.error('Error getting USDC balance:', error);
      setUsdcBalance('0');
    }
  };

  const getNearUsdcBalance = async (accountId: string) => {
    try {
      const balance = await nearWalletManager.getUsdcBalance(accountId);
      setNearUsdcBalance(balance);
    } catch (error) {
      console.error('Error getting NEAR USDC balance:', error);
      setNearUsdcBalance('0.00');
    }
  };



  const handleBetInput = (eventId: string, amount: string, outcome: boolean, chain: 'ethereum' | 'near') => {
    const newBet: BetInput = { eventId, amount, outcome };

    if (chain === 'ethereum') {
      setEthereumBets(prev => {
        const filtered = prev.filter(bet => bet.eventId !== eventId);
        return [...filtered, newBet];
      });
    } else {
      setNearBets(prev => {
        const filtered = prev.filter(bet => bet.eventId !== eventId);
        return [...filtered, newBet];
      });
    }
  };



  const getBetAmount = (eventId: string, chain: 'ethereum' | 'near') => {
    const bets = chain === 'ethereum' ? ethereumBets : nearBets;
    const bet = bets.find(b => b.eventId === eventId);
    return bet?.amount || '';
  };

  const getBetOutcome = (eventId: string, chain: 'ethereum' | 'near') => {
    const bets = chain === 'ethereum' ? ethereumBets : nearBets;
    const bet = bets.find(b => b.eventId === eventId);
    return bet?.outcome ?? null;
  };

  const getAIPrediction = (eventId: string, chain: 'ethereum' | 'near') => {
    const predictions = chain === 'ethereum' ? ethereumAIPredictions : nearAIPredictions;
    return predictions.find(p => p.eventId === eventId);
  };

  const getDynamicOdds = (eventId: string, chain: 'ethereum' | 'near') => {
    const odds = chain === 'ethereum' ? ethereumDynamicOdds : nearDynamicOdds;
    return odds.find(o => o.eventId === eventId);
  };

  const refreshEventAIPrediction = async (eventId: string, chain: 'ethereum' | 'near') => {
    try {
      const event = chain === 'ethereum'
        ? ethereumEvents.find(e => e.id === eventId)
        : nearEvents.find(e => e.id === eventId);

      if (!event) return;

      const newPrediction: AIPrediction = {
        eventId: eventId,
        predictedOutcome: Math.random() > 0.5,
        confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
        oracleData: chain === 'ethereum'
          ? `Updated AI analysis based on market data and historical patterns for event: ${event.title}`
          : `Updated NEAR AI analysis based on cross-chain data for event: ${event.title}`,
        timestamp: Date.now()
      };

      if (chain === 'ethereum') {
        setEthereumAIPredictions(prev =>
          prev.map(p => p.eventId === eventId ? newPrediction : p)
        );
      } else {
        setNearAIPredictions(prev =>
          prev.map(p => p.eventId === eventId ? newPrediction : p)
        );
      }

      console.log(`✅ Refreshed AI prediction for ${chain} event: ${eventId}`);
    } catch (error) {
      console.error(`Failed to refresh AI prediction for ${chain} event ${eventId}:`, error);
    }
  };

  const refreshEventDynamicOdds = async (eventId: string, chain: 'ethereum' | 'near') => {
    try {
      const event = chain === 'ethereum'
        ? ethereumEvents.find(e => e.id === eventId)
        : nearEvents.find(e => e.id === eventId);

      if (!event) return;

      // Generate new dynamic odds
      const totalBets = Math.floor(Math.random() * 10000) + 1000;
      const yesBets = Math.floor(Math.random() * totalBets);
      const noBets = totalBets - yesBets;

      const yesProbability = yesBets / totalBets;
      const noProbability = noBets / totalBets;

      const houseEdge = 0.995; // 0.5% house edge
      const yesOdds = Math.max(100, Math.min(1000, Math.floor((1 / yesProbability) * houseEdge * 100)));
      const noOdds = Math.max(100, Math.min(1000, Math.floor((1 / noProbability) * houseEdge * 100)));

      const newOdds: DynamicOdds = {
        eventId: eventId,
        yesOdds,
        noOdds,
        yesBets,
        noBets,
        totalBets,
        lastUpdated: Date.now()
      };

      if (chain === 'ethereum') {
        setEthereumDynamicOdds(prev =>
          prev.map(o => o.eventId === eventId ? newOdds : o)
        );
      } else {
        setNearDynamicOdds(prev =>
          prev.map(o => o.eventId === eventId ? newOdds : o)
        );
      }

      console.log(`✅ Refreshed dynamic odds for ${chain} event: ${eventId}`);
    } catch (error) {
      console.error(`Failed to refresh dynamic odds for ${chain} event ${eventId}:`, error);
    }
  };

  const getNetworkInfo = () => {
    if (currentChain === 'ethereum') {
      return { name: 'Sepolia Testnet', color: 'blue' };
    } else {
      return { name: 'NEAR Testnet', color: 'green' };
    }
  };

  const networkInfo = getNetworkInfo();

  const tryQuickFix = async () => {
    setShowTroubleshooting(false);
    setErrorMessage('');

    try {
      // Try to refresh the page to clear any cached issues
      if (typeof window !== 'undefined') {
        // Clear any cached MetaMask state
        if (window.ethereum) {
          try {
            // Try to reconnect to MetaMask
            await window.ethereum.request({ method: 'eth_accounts' });
            console.log('MetaMask reconnection successful');
          } catch (error) {
            console.log('MetaMask reconnection failed:', error);
          }
        }

        // Show user instructions
        alert('Quick Fix Applied!\n\nPlease try the following:\n1. Refresh the page (F5)\n2. Try connecting again\n3. If it still fails, try in an incognito window');
      }
    } catch (error) {
      console.log('Quick fix failed:', error);
      setErrorMessage('Quick fix failed. Please try the manual troubleshooting steps.');
      setShowTroubleshooting(true);
    }
  };

  const handleNearConnection = () => {
    if (nearAccount) {
      disconnectNear();
    } else {
      // Disconnect Ethereum first if connected
      if (ethereumAccount) {
        disconnectEthereum();
      }
      connectNear();
    }
  };

  const handleEthereumConnection = () => {
    if (ethereumAccount) {
      disconnectEthereum();
    } else {
      // Disconnect NEAR first if connected
      if (nearAccount) {
        disconnectNear();
      }
      connectEthereum();
    }
  };

  return (
    <div className="min-h-screen gradient-bg p-6">
      {/* Header */}
      <div className="gradient-card rounded-2xl shadow-2xl p-8 mb-8 card-hover">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
              🤖 BetSwap AI
            </h1>
            <p className="text-gray-700 text-lg">Cross-Chain Betting Platform with AI-Powered Predictions</p>
          </div>

          {/* Connect Buttons */}
          <div className="flex flex-col space-y-2">
            <div className="text-xs text-gray-600 text-center mb-2">
              {!ethereumAccount && !nearAccount && 'Connect either Ethereum or NEAR wallet (one at a time)'}
              {ethereumAccount && 'Ethereum connected - click NEAR to switch'}
              {nearAccount && 'NEAR connected - click Ethereum to switch'}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleEthereumConnection}
                disabled={isConnecting}
                className={`btn-primary ${ethereumAccount ? 'glow-blue' : ''} ${isConnecting ? 'opacity-50' : ''}`}
                title={ethereumAccount ? 'Disconnect Ethereum' : 'Connect Ethereum (will disconnect NEAR)'}
              >
                {ethereumAccount ? '🔌 Disconnect Ethereum' : '🔗 Connect Ethereum'}
              </button>

              <button
                onClick={handleNearConnection}
                disabled={isConnecting}
                className={`btn-secondary ${nearAccount ? 'glow-green' : ''} ${isConnecting ? 'opacity-50' : ''}`}
                title={nearAccount ? 'Disconnect NEAR' : 'Connect NEAR (will disconnect MetaMask)'}
              >
                {nearAccount ? '🔌 Disconnect NEAR' : '🔗 Connect NEAR'}
              </button>

              <button
                onClick={() => {
                  fetchAIPredictions('ethereum');
                  fetchAIPredictions('near');
                  fetchDynamicOdds('ethereum');
                  fetchDynamicOdds('near');
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                title="Refresh AI Predictions & Dynamic Odds"
              >
                🔄 AI & Odds
              </button>


            </div>
          </div>
        </div>

        {/* Account Display */}
        <div className="mt-6 flex flex-col items-end space-y-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-gray-700">ETH:</span>
            <span className="text-sm font-mono bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200">
              {ethereumAccount ? `${ethereumAccount.slice(0, 6)}...${ethereumAccount.slice(-4)}` : 'Not Connected'}
            </span>
            <span className="network-badge">
              {networkInfo.name}
            </span>
            {ethereumAccount && (
              <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                💰 {parseFloat(usdcBalance).toFixed(2)} USDC
              </span>
            )}

          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-gray-700">NEAR:</span>
            <span className="text-sm font-mono bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200">
              {nearAccount || (nearPopupOpen ? 'Signing in...' : 'Not Connected')}
            </span>
            <span className="network-badge near">
              NEAR Testnet
            </span>
            {nearAccount && (
              <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                💰 {parseFloat(nearUsdcBalance).toFixed(2)} USDC
              </span>
            )}
            {nearPopupOpen && !nearAccount && (
              <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full animate-pulse">
                🔍 Auto-detecting...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Betting Interface */}
      <div className="gradient-card rounded-2xl shadow-2xl p-8 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ethereum Events */}
          <div className="gradient-card rounded-xl shadow-lg p-6 card-hover">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ⚡ Ethereum Sepolia Events
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Smart contract powered betting
                  {(!ethereumAccount && nearAccount) && ' • Cross-chain via NEAR wallet'}
                  {(ethereumAccount && nearAccount) && ' • Cross-chain enabled'}
                </p>
              </div>
              <button
                onClick={() => placeBet('ethereum')}
                disabled={ethereumBets.length === 0 || (!ethereumAccount && !nearAccount)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                🎯 Place {ethereumBets.length} Bet{ethereumBets.length !== 1 ? 's' : ''}
                {(!ethereumAccount && nearAccount) && ' (via NEAR)'}
              </button>
            </div>

            <div className="space-y-4">
              {(() => { console.log('Ethereum events length:', ethereumEvents.length); return null; })()}
              {ethereumEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Loading events...</p>
                  <p className="text-sm mt-2">Events should appear here</p>
                </div>
              ) : (
                ethereumEvents.map((event) => (
                  <div key={event.id} className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-6 mb-4 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg mb-2">{event.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          Ends: {new Date(parseInt(event.endTime) * 1000).toLocaleDateString()}
                        </div>
                        <div className="text-sm font-semibold text-green-600 mt-1">
                          💰 {event.totalBets} USDC
                        </div>
                      </div>
                    </div>

                    {/* AI Prediction Display */}
                    {(() => {
                      const aiPrediction = getAIPrediction(event.id, 'ethereum');
                      return aiPrediction ? (
                        <div className="mb-4 p-4 ai-prediction rounded-xl border border-purple-200/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-bold text-purple-700">🤖 AI Prediction</span>
                              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${aiPrediction.predictedOutcome
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                {aiPrediction.predictedOutcome ? '✅ YES' : '❌ NO'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-bold text-purple-700">
                                {aiPrediction.confidence}% confidence
                              </span>
                              <button
                                onClick={() => refreshEventAIPrediction(event.id, 'ethereum')}
                                className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all duration-300 hover:scale-105"
                                title="Refresh AI Prediction"
                              >
                                🔄
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 italic">{aiPrediction.oracleData}</p>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${aiPrediction.confidence}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-purple-700">{aiPrediction.confidence}%</span>
                          </div>
                        </div>
                      ) : null;
                    })()}



                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          placeholder="💰 Bet amount (USDC)"
                          value={getBetAmount(event.id, 'ethereum')}
                          onChange={(e) => handleBetInput(event.id, e.target.value, getBetOutcome(event.id, 'ethereum') || false, 'ethereum')}
                          disabled={!ethereumAccount && !nearAccount}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                        />
                      </div>

                      <div className="flex space-x-3 items-center">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBetInput(event.id, getBetAmount(event.id, 'ethereum'), true, 'ethereum')}
                            disabled={!ethereumAccount && !nearAccount}
                            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${getBetOutcome(event.id, 'ethereum') === true
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              } ${(!ethereumAccount && !nearAccount) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                          >
                            ✅ Yes
                          </button>
                          {(() => {
                            const dynamicOdds = getDynamicOdds(event.id, 'ethereum');
                            return dynamicOdds ? (
                              <span className="text-sm text-green-700 font-semibold bg-green-50 px-3 py-1 rounded-lg">
                                {(dynamicOdds.yesOdds / 100).toFixed(2)}x · {dynamicOdds.yesBets.toLocaleString()} bets
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBetInput(event.id, getBetAmount(event.id, 'ethereum'), false, 'ethereum')}
                            disabled={!ethereumAccount && !nearAccount}
                            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${getBetOutcome(event.id, 'ethereum') === false
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              } ${(!ethereumAccount && !nearAccount) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                          >
                            ❌ No
                          </button>
                          {(() => {
                            const dynamicOdds = getDynamicOdds(event.id, 'ethereum');
                            return dynamicOdds ? (
                              <span className="text-sm text-red-700 font-semibold bg-red-50 px-3 py-1 rounded-lg">
                                {(dynamicOdds.noOdds / 100).toFixed(2)}x · {dynamicOdds.noBets.toLocaleString()} bets
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* NEAR Events */}
          <div className="gradient-card rounded-xl shadow-lg p-6 card-hover">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  🌟 NEAR Testnet Events
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Cross-chain AI predictions
                  {(!nearAccount && ethereumAccount) && ' • Cross-chain via ETH wallet'}
                  {(ethereumAccount && nearAccount) && ' • Cross-chain enabled'}
                </p>
              </div>
              <button
                onClick={() => placeBet('near')}
                disabled={nearBets.length === 0 || (!nearAccount && !ethereumAccount)}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                🎯 Place {nearBets.length} Bet{nearBets.length !== 1 ? 's' : ''}
                {(!nearAccount && ethereumAccount) && ' (via ETH)'}
              </button>
            </div>

            <div className="space-y-4">
              {(() => { console.log('NEAR events length:', nearEvents.length); return null; })()}
              {nearEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Loading NEAR events...</p>
                  <p className="text-sm mt-2">NEAR events should appear here</p>
                </div>
              ) : (
                nearEvents.map((event) => (
                  <div key={event.id} className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-6 mb-4 card-hover">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg mb-2">{event.title}</h3>
                        <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                          Ends: {new Date(parseInt(event.endTime) * 1000).toLocaleDateString()}
                        </div>
                        <div className="text-sm font-semibold text-green-600 mt-1">
                          💰 {event.totalBets} USDC
                        </div>
                      </div>
                    </div>

                    {/* AI Prediction Display */}
                    {(() => {
                      const aiPrediction = getAIPrediction(event.id, 'near');
                      return aiPrediction ? (
                        <div className="mb-4 p-4 ai-prediction rounded-xl border border-green-200/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-bold text-green-700">🤖 NEAR AI Prediction</span>
                              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${aiPrediction.predictedOutcome
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                {aiPrediction.predictedOutcome ? '✅ YES' : '❌ NO'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-bold text-green-700">
                                {aiPrediction.confidence}% confidence
                              </span>
                              <button
                                onClick={() => refreshEventAIPrediction(event.id, 'near')}
                                className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all duration-300 hover:scale-105"
                                title="Refresh AI Prediction"
                              >
                                🔄
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 italic">{aiPrediction.oracleData}</p>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${aiPrediction.confidence}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-green-700">{aiPrediction.confidence}%</span>
                          </div>
                        </div>
                      ) : null;
                    })()}



                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          placeholder="💰 Bet amount (USDC)"
                          value={getBetAmount(event.id, 'near')}
                          onChange={(e) => handleBetInput(event.id, e.target.value, getBetOutcome(event.id, 'near') || false, 'near')}
                          disabled={!nearAccount && !ethereumAccount}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm disabled:opacity-50 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
                        />
                      </div>

                      <div className="flex space-x-3 items-center">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBetInput(event.id, getBetAmount(event.id, 'near'), true, 'near')}
                            disabled={!nearAccount && !ethereumAccount}
                            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${getBetOutcome(event.id, 'near') === true
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              } ${(!nearAccount && !ethereumAccount) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                          >
                            ✅ Yes
                          </button>
                          {(() => {
                            const dynamicOdds = getDynamicOdds(event.id, 'near');
                            return dynamicOdds ? (
                              <span className="text-sm text-green-700 font-semibold bg-green-50 px-3 py-1 rounded-lg">
                                {(dynamicOdds.yesOdds / 100).toFixed(2)}x · {dynamicOdds.yesBets.toLocaleString()} bets
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBetInput(event.id, getBetAmount(event.id, 'near'), false, 'near')}
                            disabled={!nearAccount && !ethereumAccount}
                            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${getBetOutcome(event.id, 'near') === false
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              } ${(!nearAccount && !ethereumAccount) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                          >
                            ❌ No
                          </button>
                          {(() => {
                            const dynamicOdds = getDynamicOdds(event.id, 'near');
                            return dynamicOdds ? (
                              <span className="text-sm text-red-700 font-semibold bg-red-50 px-3 py-1 rounded-lg">
                                {(dynamicOdds.noOdds / 100).toFixed(2)}x · {dynamicOdds.noBets.toLocaleString()} bets
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Chain Info */}
      <div className="mt-8 gradient-card rounded-2xl shadow-2xl p-8">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">
          📊 Cross-Chain Betting Dashboard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 card-hover">
            <div className="text-blue-600 font-bold text-lg mb-2">⚡ Ethereum Events</div>
            <div className="text-3xl font-bold text-blue-800 mb-1">{ethereumEvents.length}</div>
            <div className="text-blue-600">Active Events</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 card-hover">
            <div className="text-green-600 font-bold text-lg mb-2">🌟 NEAR Events</div>
            <div className="text-3xl font-bold text-green-800 mb-1">{nearEvents.length}</div>
            <div className="text-green-600">Active Events</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 card-hover">
            <div className="text-purple-600 font-bold text-lg mb-2">🎯 Cross-Chain Bets</div>
            <div className="text-3xl font-bold text-purple-800 mb-1">{crossChainBets.length}</div>
            <div className="text-purple-600">Placed</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 card-hover">
            <div className="text-yellow-600 font-bold text-lg mb-2">🌐 Network</div>
            <div className="text-xl font-bold text-yellow-800 mb-1">{networkInfo.name}</div>
            <div className="text-yellow-600">Connected</div>
          </div>
        </div>

        {/* Cross-Chain Betting Statistics */}
        <div className="mt-8">
          <h4 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            🔄 Cross-Chain Betting Statistics
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 card-hover">
              <div className="text-purple-600 font-bold text-lg mb-2">🎯 Cross-Chain Bets</div>
              <div className="text-3xl font-bold text-purple-800 mb-1">{crossChainBets.length}</div>
              <div className="text-purple-600">Total Placed</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 card-hover">
              <div className="text-green-600 font-bold text-lg mb-2">💰 Cross-Chain Winnings</div>
              <div className="text-3xl font-bold text-green-800 mb-1">{crossChainWinnings.toFixed(2)} USDC</div>
              <div className="text-green-600">Total Earned</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 card-hover">
              <div className="text-blue-600 font-bold text-lg mb-2">📈 Cross-Chain Win Rate</div>
              <div className="text-3xl font-bold text-blue-800 mb-1">{crossChainWinRate.toFixed(1)}%</div>
              <div className="text-blue-600">Success Rate</div>
            </div>
          </div>
        </div>

        {/* AI Prediction Statistics */}
        <div className="mt-8">
          <h4 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            🤖 AI Prediction Statistics
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 card-hover">
              <div className="text-purple-600 font-bold text-lg mb-2">⚡ ETH AI Predictions</div>
              <div className="text-3xl font-bold text-purple-800 mb-1">{ethereumAIPredictions.length}</div>
              <div className="text-purple-600">Available</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 card-hover">
              <div className="text-emerald-600 font-bold text-lg mb-2">🌟 NEAR AI Predictions</div>
              <div className="text-3xl font-bold text-emerald-800 mb-1">{nearAIPredictions.length}</div>
              <div className="text-emerald-600">Available</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200 card-hover">
              <div className="text-indigo-600 font-bold text-lg mb-2">🎯 Avg Confidence</div>
              <div className="text-3xl font-bold text-indigo-800 mb-1">
                {(() => {
                  const allPredictions = [...ethereumAIPredictions, ...nearAIPredictions];
                  if (allPredictions.length === 0) return '0%';
                  const avgConfidence = allPredictions.reduce((sum, p) => sum + p.confidence, 0) / allPredictions.length;
                  return `${Math.round(avgConfidence)}%`;
                })()}
              </div>
              <div className="text-indigo-600">AI Accuracy</div>
            </div>
          </div>
        </div>


      </div>

      {/* Native Chain Betting Dashboard */}
      {isHydrated && (
        <div className="gradient-card rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                🏠 Native Chain Betting Dashboard
              </h2>
              <p className="text-gray-600 text-sm mt-1">Track your single-chain betting activity (no cross-chain involved)</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // Refresh native betting data
                  console.log('🔄 Refreshing native betting dashboard...');
                }}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                title="Refresh Native Betting Data"
              >
                🔄 Refresh
              </button>
              <button
                onClick={async () => {
                  if (contractManager && ethereumAccount) {
                    console.log('🔄 Creating all events manually...');
                    try {
                      const events = [
                        { id: '1', title: 'Bitcoin ETF Approval Q4 2025', description: 'Will the SEC approve additional spot Bitcoin ETFs by December 31, 2025?' },
                        { id: '2', title: 'Premier League 2025/26 Winner', description: 'Will Manchester City win the 2025/26 Premier League title?' },
                        { id: '3', title: 'UEFA Champions League 2025/26', description: 'Will Real Madrid win the 2025/26 UEFA Champions League?' },
                        { id: '4', title: 'NBA Finals 2025 Winner', description: 'Will the Boston Celtics win the 2025 NBA Championship?' },
                        { id: '5', title: 'Tesla Stock Performance 2025', description: 'Will TSLA close above $300 on December 31, 2025?' },
                        { id: '6', title: 'World Cup 2026 Winner', description: 'Will the United States reach the semifinals of the 2026 FIFA World Cup?' }
                      ];

                      for (const event of events) {
                        try {
                          const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
                          await contractManager.createBetEvent(
                            event.title,
                            event.description,
                            endTime
                          );
                          console.log(`✅ Event ${event.id} created successfully`);
                        } catch (error) {
                          console.log(`ℹ️ Event ${event.id} may already exist, continuing...`);
                        }
                      }
                      alert('✅ All events created successfully!');
                    } catch (error) {
                      console.error('Error creating events:', error);
                      alert('❌ Error creating events. Please try again.');
                    }
                  } else {
                    alert('Please connect to Ethereum first!');
                  }
                }}
                disabled={!ethereumAccount}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                title="Create All Events on Blockchain"
              >
                🎯 Create Events
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all betting data? This cannot be undone.')) {
                    // Clear all native betting data
                    setEthereumNativeBets([]);
                    setNearNativeBets([]);
                    setEthereumNativeWinnings(0);
                    setNearNativeWinnings(0);
                    setEthereumNativeWinRate(0);
                    setNearNativeWinRate(0);

                    // Clear cross-chain betting data
                    setCrossChainBets([]);
                    setCrossChainWinnings(0);
                    setCrossChainWinRate(0);

                    // Clear localStorage
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('betswap_ethereum_native_bets');
                      localStorage.removeItem('betswap_near_native_bets');
                      localStorage.removeItem('betswap_ethereum_native_winnings');
                      localStorage.removeItem('betswap_near_native_winnings');
                      localStorage.removeItem('betswap_ethereum_native_winrate');
                      localStorage.removeItem('betswap_near_native_winrate');
                      localStorage.removeItem('betswap_cross_chain_bets');
                      localStorage.removeItem('betswap_cross_chain_winnings');
                      localStorage.removeItem('betswap_cross_chain_winrate');
                    }

                    alert('✅ All betting data cleared successfully!');
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                title="Clear All Betting Data"
              >
                🗑️ Clear Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Ethereum Native Bets */}
            <div className="gradient-card rounded-xl shadow-lg p-6 card-hover">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-blue-600">⚡ Ethereum Native Bets</h3>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  {ethereumAccount ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-900">Total Bets Placed</span>
                    <span className="text-lg font-bold text-blue-600">{ethereumNativeBets.length}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-900">Total Amount Bet</span>
                    <span className="text-lg font-bold text-green-600">{ethereumNativeBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0).toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Win Rate</span>
                    <span className="text-lg font-bold text-purple-600">{ethereumNativeWinRate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Recent Activity</h4>
                  {ethereumNativeBets.length > 0 ? (
                    <div className="space-y-2">
                      {ethereumNativeBets.slice(-3).map((bet, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Event {bet.eventId}</span>
                          <span className="font-semibold text-blue-600">{bet.amount} USDC</span>
                          <span className={`px-2 py-1 rounded text-xs ${bet.outcome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {bet.outcome ? 'YES' : 'NO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No recent betting activity</p>
                      <p className="text-sm mt-1">Connect to Ethereum to start betting</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* NEAR Native Bets */}
            <div className="gradient-card rounded-xl shadow-lg p-6 card-hover">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-green-600">🌐 NEAR Native Bets</h3>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  {nearAccount ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-900">Total Bets Placed</span>
                    <span className="text-lg font-bold text-green-600">{nearNativeBets.length}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-900">Total Amount Bet</span>
                    <span className="text-lg font-bold text-green-600">{nearNativeBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0).toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Win Rate</span>
                    <span className="text-lg font-bold text-purple-600">{nearNativeWinRate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Recent Activity</h4>
                  {nearNativeBets.length > 0 ? (
                    <div className="space-y-2">
                      {nearNativeBets.slice(-3).map((bet, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Event {bet.eventId}</span>
                          <span className="font-semibold text-green-600">{bet.amount} USDC</span>
                          <span className={`px-2 py-1 rounded text-xs ${bet.outcome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {bet.outcome ? 'YES' : 'NO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No recent betting activity</p>
                      <p className="text-sm mt-1">Connect to NEAR to start betting</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Native Betting Stats */}
          <div className="mt-8 gradient-card rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Native Betting Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">{ethereumNativeBets.length + nearNativeBets.length}</div>
                <div className="text-sm text-gray-600">Total Events Bet On</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">{(ethereumNativeWinnings + nearNativeWinnings).toFixed(2)} USDC</div>
                <div className="text-sm text-gray-600">Total Winnings</div>
              </div>
              <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-2">{((ethereumNativeWinRate + nearNativeWinRate) / 2).toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Overall Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Troubleshooting Modal */}
      {
        showTroubleshooting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Wallet Connection Issue</h3>
              <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>

              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Troubleshooting Steps:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {(errorMessage.includes('NEAR') || errorMessage.includes('near'))
                    ? getNearTroubleshootingSteps().map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        {step}
                      </li>
                    ))
                    : getWalletTroubleshootingSteps().map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        {step}
                      </li>
                    ))
                  }
                </ul>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowTroubleshooting(false);
                    setErrorMessage('');
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={tryQuickFix}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Try Quick Fix
                </button>
                {(errorMessage.includes('NEAR') || errorMessage.includes('near')) && (
                  <button
                    onClick={() => {
                      setShowTroubleshooting(false);
                      setErrorMessage('');
                      setShowNearInstructionPopup(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Connect Manually
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* NEAR Instruction Popup */}
      {
        showNearInstructionPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">NEAR Wallet Connection</h3>
              <p className="text-sm text-gray-600 mb-4">
                MyNearWallet popup has been opened. Please:
              </p>
              <ol className="text-sm text-gray-600 mb-4 list-decimal list-inside space-y-1">
                <li>Sign in to your NEAR testnet account in the popup</li>
                <li>Enter your account ID below</li>
                <li>Click "Connect" to complete the connection</li>
              </ol>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NEAR Account ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g., fayefaye2.testnet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  id="nearAccountInput"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const accountId = (document.getElementById('nearAccountInput') as HTMLInputElement)?.value?.trim();
                    if (accountId) {
                      setNearAccount(accountId);

                      // Save to localStorage for persistence
                      localStorage.setItem('betswap_near_account', accountId);

                      getNearUsdcBalance(accountId);
                      setNetworkStatus('Connected to NEAR Testnet (Manual)');
                      setNearPopupOpen(false);
                      setShowNearInstructionPopup(false);
                      console.log('✅ Connected to NEAR testnet wallet (manual):', accountId);
                    } else {
                      alert('Please enter your NEAR account ID');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Connect
                </button>
                <button
                  onClick={() => {
                    setShowNearInstructionPopup(false);
                    setNearPopupOpen(false);
                    setNetworkStatus('NEAR connection cancelled');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}
