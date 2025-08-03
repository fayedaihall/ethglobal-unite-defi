require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      initialBaseFeePerGas: 0,
      accounts: [
        {
          privateKey:
            "0x89791bdb4e6ce25349c979710af8c6f7088f4d92136342f218169539801dbb42",
          balance: "10000000000000000000000", // 10,000 ETH
        },
        // Default Hardhat accounts with huge balances
        {
          privateKey:
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          balance: "10000000000000000000000", // 10,000 ETH
        },
      ],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [
        "0x89791bdb4e6ce25349c979710af8c6f7088f4d92136342f218169539801dbb42",
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      ],
    },
    sepolia: {
      url: process.env.ETH_RPC || "https://1rpc.io/sepolia",
      chainId: 11155111,
      accounts: process.env.ETH_PRIVATE_KEY
        ? [process.env.ETH_PRIVATE_KEY]
        : [],
    },
  },
};
