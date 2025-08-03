# BetSwap AI Frontend - Sepolia Testnet

A minimalist Next.js frontend for demonstrating cross-chain betting between Ethereum Sepolia testnet and NEAR testnet.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **MetaMask** browser extension
- **Sepolia testnet ETH** (get from [Sepolia Faucet](https://sepoliafaucet.com/))
- **NEAR testnet account** (optional for demo)

### Installation

1. **Install dependencies:**

```bash
cd frontend
npm install
```

2. **Start the development server:**

```bash
npm run dev
```

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Network Settings

The app is configured for:

- **Ethereum Sepolia Testnet** (Chain ID: 11155111)
- **NEAR Testnet** (simulated)

### Contract Addresses

```typescript
// Sepolia Testnet Contract Addresses
BETSWAP_AI_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
USDC_ADDRESS: "0x51A1ceB83B83F1985a81C295d1fF28Afef186E02";
HTLC_ADDRESS: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
```

## 🎯 Features

### ✅ Ethereum Sepolia Integration

- **MetaMask Connection**: Automatic Sepolia network detection
- **Contract Interaction**: Real smart contract calls
- **Token Balance**: Live BET token balance display
- **Transaction Signing**: Secure transaction signing
- **Network Switching**: Automatic Sepolia network switching

### ✅ NEAR Testnet Integration

- **Simulated Connection**: Demo NEAR wallet connection
- **Cross-Chain Events**: NEAR-specific betting events
- **Unified Interface**: Same UI for both chains

### ✅ Cross-Chain Functionality

- **Dual Network Support**: Ethereum + NEAR simultaneously
- **Account Management**: Switch between chains
- **Bet Tracking**: Real-time bet status
- **Balance Monitoring**: Live token balances

## 🎲 How to Use

### 1. Connect Wallets

#### Ethereum (Sepolia)

1. Click **"Connect ETH"** button
2. MetaMask will prompt for connection
3. Approve the connection
4. If not on Sepolia, the app will automatically switch networks
5. Your account address and BET balance will display

#### NEAR (Testnet)

1. Click **"Connect NEAR"** button
2. For demo purposes, a mock account will be created
3. NEAR account status will display

### 2. Place Bets

#### Ethereum Events

1. **Select an event** from the left panel
2. **Enter bet amount** in BET tokens
3. **Choose outcome** (Yes/No)
4. **Click "Place Bets"** to submit
5. **Confirm transaction** in MetaMask

#### NEAR Events

1. **Select an event** from the right panel
2. **Enter bet amount** in BET tokens
3. **Choose outcome** (Yes/No)
4. **Click "Place Bets"** to submit
5. **Simulated transaction** will complete

### 3. Monitor Status

- **Network Status**: Shows connection status
- **Account Balance**: Live BET token balance
- **Pending Bets**: Number of bets ready to submit
- **Transaction History**: Console logs for debugging

## 🔍 Sample Events

### Ethereum Sepolia Events

- **Bitcoin Price Prediction**: Will Bitcoin reach $150,000 by August 2025?
- **Ethereum L2 Adoption**: Will L2 TVL exceed $100B by August 2025?
- **DeFi Security**: Will any major DeFi protocol be hacked in August 2025?
- **NFT Recovery**: Will NFT trading volume exceed $1B in August 2025?

### NEAR Testnet Events

- **NEAR Protocol Growth**: Will daily active users exceed 1M by August 2025?
- **NEAR DeFi TVL**: Will NEAR DeFi TVL reach $5B by August 2025?
- **NEAR Developer Adoption**: Will NEAR have 10,000+ active developers?
- **NEAR Cross-Chain**: Will NEAR have 50+ cross-chain bridges?

## 🛠 Technical Architecture

### Frontend Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Ethers.js v6**: Ethereum wallet integration

### Contract Integration

- **Contract Manager**: Centralized contract interaction
- **ABI Definitions**: Type-safe contract calls
- **Error Handling**: Graceful error management
- **Transaction Monitoring**: Real-time status updates

### Network Configuration

```typescript
// Sepolia Network Config
{
  chainId: '0xaa36a7',
  chainName: 'Sepolia Testnet',
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
}
```

## 🔧 Development

### Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Main betting interface
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── config/
│   └── networks.ts           # Network configurations
├── utils/
│   └── contracts.ts          # Contract interaction utilities
├── types/
│   └── global.d.ts           # TypeScript declarations
└── package.json              # Dependencies
```

### Key Components

#### Contract Manager

```typescript
// Initialize contract manager
const contractManager = createContractManager(provider);
await contractManager.initialize(signer);

// Place a bet
const txHash = await contractManager.placeBet(eventId, amount, outcome);
```

#### Network Detection

```typescript
// Check if on Sepolia
const chainId = await window.ethereum.request({ method: "eth_chainId" });
if (chainId !== "0xaa36a7") {
  // Switch to Sepolia
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
}
```

## 🚨 Troubleshooting

### Common Issues

#### MetaMask Connection Failed

- **Solution**: Ensure MetaMask is installed and unlocked
- **Check**: MetaMask is on Sepolia testnet
- **Verify**: Account has Sepolia ETH for gas fees

#### Contract Interaction Errors

- **Solution**: Check contract addresses are correct
- **Verify**: Contracts are deployed on Sepolia
- **Debug**: Check browser console for error details

#### Network Switching Issues

- **Solution**: Manually add Sepolia to MetaMask
- **Network Details**:
  - Chain ID: 11155111
  - RPC URL: https://rpc.sepolia.org
  - Explorer: https://sepolia.etherscan.io

### Getting Sepolia ETH

1. **Visit Sepolia Faucet**: https://sepoliafaucet.com/
2. **Connect your wallet**
3. **Request test ETH**
4. **Wait for confirmation**

## 🔗 Useful Links

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **MetaMask**: https://metamask.io/
- **NEAR Testnet**: https://testnet.near.org/

## 🎉 Demo Features

### Real Contract Interaction

- ✅ **Live Sepolia transactions**
- ✅ **Real BET token transfers**
- ✅ **Smart contract function calls**
- ✅ **Transaction confirmation**

### Cross-Chain Simulation

- ✅ **Dual network interface**
- ✅ **Chain switching**
- ✅ **Unified betting experience**
- ✅ **Real-time status updates**

### User Experience

- ✅ **Minimalist design**
- ✅ **Responsive layout**
- ✅ **Error handling**
- ✅ **Loading states**

## 🚀 Next Steps

1. **Deploy to Production**: Configure for mainnet
2. **Add NEAR Integration**: Real NEAR wallet connection
3. **Cross-Chain Bridge**: Implement actual cross-chain transfers
4. **Event Management**: Add event creation and management
5. **Analytics**: Add betting analytics and statistics

---

**The BetSwap AI frontend is now fully functional on Ethereum Sepolia testnet!** 🎉

Connect your MetaMask, get some Sepolia ETH, and start placing bets on the future of blockchain technology!
