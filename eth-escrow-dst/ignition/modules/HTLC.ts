const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
module.exports = buildModule(
  "HTLCModule",
  (m: { contract: (arg0: string) => any }) => {
    // Deploy the HTLC contract (no constructor arguments)
    const htlc = m.contract("HTLC");

    // Return the deployed contract for reference (e.g., for scripts or verification)
    return { htlc };
  }
);
