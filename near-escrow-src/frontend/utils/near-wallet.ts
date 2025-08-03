import { connect, keyStores, WalletConnection, Near } from "near-api-js";
import BN from "bn.js";
import { ethers } from "ethers";

export interface NearConfig {
  networkId: string;
  nodeUrl: string;
  walletUrl: string;
  helperUrl: string;
  explorerUrl: string;
}

export const getNearConfig = (): NearConfig => {
  return {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
  };
};

export class NearWalletManager {
  private near: Near | null = null;
  private walletConnection: WalletConnection | null = null;

  async initialize(): Promise<void> {
    try {
      const config = getNearConfig();

      // Create a key store for the browser
      const keyStore = new keyStores.BrowserLocalStorageKeyStore();

      // Initialize NEAR connection with basic configuration
      this.near = await connect({
        networkId: config.networkId,
        nodeUrl: config.nodeUrl,
        keyStore,
      });

      // Initialize wallet connection with simple app name
      this.walletConnection = new WalletConnection(this.near, "betswap");

      console.log("✅ NEAR testnet wallet manager initialized");
    } catch (error) {
      console.error(
        "❌ Failed to initialize NEAR testnet wallet manager:",
        error
      );
      throw error;
    }
  }

  async checkSignInStatus(): Promise<string | null> {
    try {
      if (!this.walletConnection) {
        await this.initialize();
      }

      if (this.walletConnection!.isSignedIn()) {
        const accountId = this.walletConnection!.getAccountId();
        console.log("✅ User is signed in to NEAR testnet wallet:", accountId);
        return accountId;
      }

      return null;
    } catch (error) {
      console.error("❌ Error checking NEAR sign-in status:", error);
      return null;
    }
  }

  async connectWallet(): Promise<string | null> {
    try {
      if (!this.walletConnection) {
        await this.initialize();
      }

      if (!this.walletConnection!.isSignedIn()) {
        // Open MyNearWallet in a popup window for sign-in
        console.log("🔄 Opening MyNearWallet testnet popup for sign-in...");

        const popup = window.open(
          "https://testnet.mynearwallet.com/",
          "nearWalletPopup",
          "width=500,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes"
        );

        if (!popup) {
          throw new Error(
            "Popup blocked by browser. Please allow popups for this site."
          );
        }

        // Return null to indicate user needs to sign in
        return null;
      }

      const accountId = this.walletConnection!.getAccountId();
      console.log("✅ Connected to NEAR testnet wallet:", accountId);
      return accountId;
    } catch (error) {
      console.error("❌ Failed to connect to NEAR testnet wallet:", error);
      throw error;
    }
  }

  async disconnectWallet(): Promise<void> {
    try {
      if (this.walletConnection) {
        this.walletConnection.signOut();
        console.log("✅ Disconnected from NEAR testnet wallet");
      }
    } catch (error) {
      console.error("❌ Failed to disconnect from NEAR testnet wallet:", error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.walletConnection?.isSignedIn() || false;
  }

  getAccountId(): string | null {
    return this.walletConnection?.getAccountId() || null;
  }

  async getAccountBalance(): Promise<string> {
    if (!this.near || !this.walletConnection) {
      throw new Error("NEAR not initialized");
    }

    try {
      const account = await this.near.account(
        this.walletConnection.getAccountId()
      );
      const balance = await account.getAccountBalance();
      return ethers.formatEther(balance.total);
    } catch (error) {
      console.error("Error getting NEAR balance:", error);
      return "0";
    }
  }

  async getUsdcBalance(accountId: string): Promise<string> {
    // For demo purposes, simulate USDC balance on NEAR
    // In a real implementation, this would query the NEAR USDC contract
    try {
      // Simulate a higher balance for fayefaye2.testnet
      if (accountId === "fayefaye2.testnet") {
        return "10000.00"; // 10,000 USDC
      }
      const mockBalance = Math.floor(Math.random() * 10000) + 1000; // Random balance between 1000-11000
      return (mockBalance / 100).toFixed(2); // Format as USDC with 2 decimal places
    } catch (error) {
      console.error("Error getting NEAR USDC balance:", error);
      return "0.00";
    }
  }

  async signAndSendTransaction(
    contractId: string,
    methodName: string,
    args: any,
    gas: string = "300000000000000",
    deposit: string = "0"
  ): Promise<any> {
    try {
      if (!this.walletConnection?.isSignedIn()) {
        throw new Error("Wallet not connected");
      }

      const account = this.walletConnection.account();
      const result = await account.functionCall({
        contractId,
        methodName,
        args,
        gas: new BN(gas),
        attachedDeposit: new BN(deposit),
      });

      console.log("✅ Transaction sent:", result);
      return result;
    } catch (error) {
      console.error("❌ Failed to send transaction:", error);
      throw error;
    }
  }
}

// Create a singleton instance
export const nearWalletManager = new NearWalletManager();
