#!/bin/bash

echo "🚀 Setting up BetSwap AI Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Ethereum Configuration
NEXT_PUBLIC_ETHEREUM_RPC_URL=http://localhost:8545
NEXT_PUBLIC_ETHEREUM_NETWORK=localhost

# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.testnet.near.org

# Contract Addresses (will be updated after deployment)
NEXT_PUBLIC_BETSWAP_AI_ADDRESS=
NEXT_PUBLIC_BET_TOKEN_ADDRESS=
NEXT_PUBLIC_HTLC_ADDRESS=
EOF
    echo "✅ .env.local created"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
echo "Make sure you have MetaMask installed for Ethereum wallet connection!" 