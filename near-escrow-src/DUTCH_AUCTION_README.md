# Dutch Auction with 1inch Fusion+ Cross-Chain Swap Integration

## Overview

This project implements a novel extension for 1inch Cross-chain Swap (Fusion+) that enables bidirectional swaps between Ethereum and NEAR, featuring Dutch auction functionality with hashlock and timelock mechanisms.

## Key Features

### ✅ Requirements Met

1. **1inch Fusion+ Integration**: Novel extension enabling cross-chain swaps between Ethereum and NEAR
2. **Hashlock & Timelock Preservation**: Maintains non-EVM hashlock and timelock functionality
3. **Bidirectional Swaps**: Full support for ETH↔NEAR swaps in both directions
4. **Dutch Auction Integration**: Combines auction mechanics with cross-chain escrow

### 🔄 Cross-Chain Swap Directions

- **ETH_TO_NEAR**: Swap tokens from Ethereum to NEAR
- **NEAR_TO_ETH**: Swap tokens from NEAR to Ethereum

### 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Ethereum      │    │   HTLC Lock     │    │     NEAR        │
│                 │◄──►│                 │◄──►│                 │
│ • Dutch Auction │    │ • Hashlock      │    │ • Escrow        │
│ • USDC Token    │    │ • Timelock      │    │ • Resolver      │
│ • HTLC Contract │    │ • Cross-chain   │    │ • Withdrawal    │
└─────────────────┘    │   Escrow        │    └─────────────────┘
                       └─────────────────┘
```

## Smart Contracts

### Ethereum Contracts

- **DutchAuction.sol**: Dutch auction with escrow integration
- **HTLC.sol**: Hashed Timelock Contract for cross-chain escrow
- **MockUSDC.sol**: USDC token for testing

### NEAR Contracts

- **Escrow Contract**: Handles NEAR-side escrow operations
- **Resolver Registration**: Manages cross-chain resolution

## Usage

### 1inch Fusion+ Cross-Chain Swaps

#### Create Cross-Chain Swap

```bash
# ETH to NEAR swap
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts fusion-swap \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  0x0000000000000000000000000000000000000000 \
  1000000 \
  ETH_TO_NEAR

# NEAR to ETH swap
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts fusion-swap \
  0x0000000000000000000000000000000000000000 \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  1000000 \
  NEAR_TO_ETH
```

#### Execute Cross-Chain Swap

```bash
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts execute-fusion \
  453206 \
  "bd4b9adf13f3d0cf436a195341f472dc9e5016d8b344345b786f5b44af666d78" \
  ETH_TO_NEAR
```

### Dutch Auction with Escrow

#### Create Auction (Ethereum Direction)

```bash
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts create \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  1000000 500000 3600 300 50000 \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

#### Create Auction (NEAR Direction)

```bash
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts create-near \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  1000000 500000 3600 300 50000 \
  fayefaye2.testnet
```

#### Place Bid (Ethereum Direction)

```bash
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts bid \
  0 411694 "2125c715c02443432504389d0d720d9cb9eaf2fecf38823dc4f6accce0f"
```

#### Place Bid (NEAR Direction)

```bash
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts bid-near \
  2 643593 "7108c84533679fc0e57bc8935cb1eaa537b24300b401db72b5cfef9209394f0a" \
  fayefaye2.testnet
```

## Available Commands

### Cross-Chain Swap Commands

- `fusion-swap <fromToken> <toToken> <fromAmount> <swapDirection>` - Create cross-chain swap
- `execute-fusion <escrowId> <secret> <swapDirection>` - Execute cross-chain swap

### Auction Commands

- `create <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userEthAddress>` - Create ETH→NEAR auction
- `create-near <tokenAddress> <startAmount> <minAmount> <duration> <stepTime> <stepAmount> <userNearAccountId>` - Create NEAR→ETH auction
- `bid <auctionId> <escrowId> <secret>` - Place bid (ETH direction)
- `bid-near <auctionId> <escrowId> <secret> <nearAccountId>` - Place bid (NEAR direction)
- `status <auctionId>` - Check auction status

### Swap Directions

- `ETH_TO_NEAR` - Swap from Ethereum to NEAR
- `NEAR_TO_ETH` - Swap from NEAR to Ethereum

## Security Features

### Hashlock Mechanism

- Uses SHA256 hash of 32-byte secret
- Ensures atomic cross-chain operations
- Prevents front-running attacks

### Timelock Protection

- 2-hour timelock on all escrow operations
- Allows refund if swap fails
- Protects against network issues

### Bidirectional Escrow

- HTLC locks on both chains
- Resolver registration on NEAR
- Cross-chain secret verification

## Environment Variables

```bash
# Ethereum Configuration
ETH_RPC=http://localhost:8545
ETH_PRIVATE_KEY=0x...
HTLC_ETH_ADDRESS=0x...
USDC_ETH_ADDRESS=0x...
DUTCH_AUCTION_ETH_ADDRESS=0x...

# NEAR Configuration
NEAR_NETWORK=testnet
NEAR_RPC=https://rpc.testnet.near.org
RESOLVER_NEAR_PRIVATE_KEY=...
RESOLVER_NEAR_ACCOUNT_ID=...
ESCROW_NEAR_ACCOUNT_ID=...
```

## Deployment

### Deploy Smart Contracts

```bash
# Deploy USDC
export NODE_ENV=testnet && ts-node deploy-mock-usdc.ts

# Deploy HTLC
export NODE_ENV=testnet && ts-node deploy-eth.ts

# Deploy Dutch Auction
export NODE_ENV=testnet && ts-node deploy-dutch-auction.ts
```

### Start Local Network

```bash
npx hardhat node
```

## Testing

### Test Cross-Chain Swap

```bash
# Create swap
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts fusion-swap \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  0x0000000000000000000000000000000000000000 \
  1000000 \
  ETH_TO_NEAR

# Execute swap (use escrowId and secret from above)
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts execute-fusion \
  <escrowId> <secret> ETH_TO_NEAR
```

### Test Dutch Auction

```bash
# Create auction
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts create \
  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707 \
  1000000 500000 3600 300 50000 \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Place bid (use auctionId, escrowId, and secret from above)
export NODE_ENV=testnet && ts-node scripts/auction-escrow-integration.ts bid \
  <auctionId> <escrowId> <secret>
```

## Architecture Benefits

1. **Novel 1inch Fusion+ Extension**: Extends 1inch with cross-chain Dutch auction capabilities
2. **Bidirectional Swaps**: Full ETH↔NEAR swap support
3. **Hashlock Security**: Cryptographic guarantees for cross-chain operations
4. **Timelock Protection**: Time-based security for failed swaps
5. **Non-EVM Compatibility**: Preserves NEAR's unique features
6. **Atomic Operations**: Ensures swap success or complete rollback

## Future Enhancements

- Integration with actual 1inch Fusion+ API
- Support for additional tokens (ERC-20, NEP-141)
- Advanced auction types (English, sealed-bid)
- Cross-chain liquidity pools
- MEV protection mechanisms
