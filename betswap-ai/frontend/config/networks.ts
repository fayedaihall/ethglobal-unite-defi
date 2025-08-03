export const NETWORKS = {
  ethereum: {
    sepolia: {
      chainId: "0xaa36a7",
      chainName: "Sepolia Testnet",
      nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "SEP",
        decimals: 18,
      },
      rpcUrls: ["https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
      contracts: {
        betSwapAI: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        htlc: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
        dutchAuction: "0x998abeb3E57409262aE5b751f60747921B33613E",
        betAuction: "0x0000000000000000000000000000000000000000", // TODO: Deploy BetAuction contract
      },
    },
  },
  near: {
    testnet: {
      networkId: "testnet",
      nodeUrl: "https://rpc.testnet.near.org",
      walletUrl: "https://wallet.testnet.near.org",
      helperUrl: "https://helper.testnet.near.org",
      explorerUrl: "https://explorer.testnet.near.org",
    },
  },
};

export const getContractAddress = (
  contract: string,
  network: string = "sepolia"
) => {
  return (NETWORKS.ethereum as any)[network]?.contracts[contract] || "";
};

export const getNetworkConfig = (network: string = "sepolia") => {
  return (NETWORKS.ethereum as any)[network] || null;
};
