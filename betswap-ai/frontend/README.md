# BetSwap AI Frontend

A minimalist Next.js frontend for demonstrating cross-chain betting between Ethereum and NEAR.

## Features

- **Cross-Chain Betting**: Place bets on events from both Ethereum and NEAR
- **Wallet Integration**: Connect MetaMask for Ethereum and NEAR wallet
- **Real-Time Updates**: Live bet tracking and event status
- **Minimalist Design**: Clean, simple interface focused on functionality

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask browser extension (for Ethereum)
- NEAR wallet (for NEAR)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Connecting Wallets

1. **Ethereum**: Click "Connect ETH" to connect MetaMask
2. **NEAR**: Click "Connect NEAR" to connect NEAR wallet

### Placing Bets

1. **Select Events**: Browse available events on both chains
2. **Enter Amount**: Input your bet amount in BET tokens
3. **Choose Outcome**: Click "Yes" or "No" for your prediction
4. **Place Bet**: Click "Place Bets" to submit your bets

### Event Types

#### Ethereum Events
- Bitcoin Price Prediction
- Ethereum Layer 2 Adoption
- DeFi Protocol Security
- NFT Market Recovery

#### NEAR Events
- NEAR Protocol Growth
- NEAR DeFi TVL
- NEAR Developer Adoption
- NEAR Cross-Chain Integration

## Architecture

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Ethers.js**: Ethereum wallet integration
- **Responsive Design**: Works on desktop and mobile

## Development

### Project Structure

```
frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── types/
│   └── global.d.ts
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### Key Components

- **Header**: Account display and wallet connection
- **Event Cards**: Individual betting events with input fields
- **Bet Management**: Track and submit bets
- **Cross-Chain Stats**: Overview of betting activity

## Customization

### Adding New Events

Edit the `sampleEthereumEvents` and `sampleNearEvents` arrays in `page.tsx`:

```typescript
const newEvent: BettingEvent = {
  id: 'unique_id',
  title: 'Event Title',
  description: 'Event description',
  endTime: '2025-08-31T23:59:59Z',
  totalBets: '1000000',
  outcome: null,
  resolved: false
};
```

### Styling

The app uses Tailwind CSS for styling. Custom styles can be added to `globals.css`.

## Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Create a `.env.local` file for environment-specific configuration:

```env
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
NEXT_PUBLIC_NEAR_NETWORK=mainnet
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details. 