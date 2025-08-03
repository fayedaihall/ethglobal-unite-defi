export const checkWalletExtensions = () => {
  const extensions = [];

  // Check for common wallet extensions
  if (typeof window.ethereum !== "undefined") {
    extensions.push("MetaMask");
  }

  // Check for other potential conflicting extensions
  const extensionIds = [
    "opfgelmcmbiajamepnmloijbpoleiama", // The one causing your error
    "nkbihfbeogaeaoehlefnkodbefgpgknn", // MetaMask
    "hnfanknocfeofbddlgcijnmhnfnkdna", // Coinbase Wallet
    "cflbjfdoiomijofnaodojldgfeicbbk", // Phantom
  ];

  extensionIds.forEach((id) => {
    try {
      if (window.chrome?.runtime?.sendMessage) {
        // This might trigger the error, so we'll catch it
        try {
          window.chrome.runtime.sendMessage(id, { method: "ping" });
        } catch (e) {
          // Extension exists but might be conflicting
        }
      }
    } catch (e) {
      // Extension doesn't exist or is causing issues
    }
  });

  return extensions;
};

export const getWalletTroubleshootingSteps = () => {
  return [
    "1. Disable the Chrome extension 'opfgelmcmbiajamepnmloijbpoleiama' (likely another wallet)",
    "2. Go to chrome://extensions/ and disable other wallet extensions temporarily",
    "3. Refresh the page (Ctrl+F5 or Cmd+Shift+R)",
    "4. Make sure MetaMask is unlocked",
    "5. Try connecting in an incognito/private window",
    "6. Check if MetaMask is on Sepolia testnet",
    "7. Clear browser cache and cookies",
    "8. If MetaMask is installed but not detected, try restarting your browser",
    "9. Check if MetaMask is enabled in chrome://extensions/",
    "10. Try disabling all extensions temporarily to isolate the issue",
  ];
};

export const getNearTroubleshootingSteps = () => {
  return [
    "1. Make sure you have a NEAR testnet account",
    "2. Allow popups for this site in your browser",
    "3. Sign in to MyNearWallet in the popup window",
    "4. Close the popup after signing in",
    "5. Click 'Connect NEAR' again to complete connection",
    "6. Check if your NEAR account ID ends with .testnet",
    "7. Try entering your account ID manually (e.g., fayefaye2.testnet)",
    "8. Clear browser cache and cookies",
    "9. Try connecting in an incognito/private window",
    "10. Check if you have sufficient NEAR tokens for gas fees",
  ];
};

export const isMetaMaskInstalled = (): boolean => {
  return (
    typeof window !== "undefined" && typeof window.ethereum !== "undefined"
  );
};

export const isMetaMaskUnlocked = async (): Promise<boolean> => {
  if (!isMetaMaskInstalled()) return false;

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    return accounts && accounts.length > 0;
  } catch (error) {
    console.log("Error checking MetaMask unlock status:", error);
    return false;
  }
};

export const getCurrentNetwork = async (): Promise<string> => {
  if (!isMetaMaskInstalled()) return "Not connected";

  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    switch (chainId) {
      case "0x1":
        return "Ethereum Mainnet";
      case "0xaa36a7":
        return "Sepolia Testnet";
      case "0x5":
        return "Goerli Testnet";
      default:
        return `Unknown Network (${chainId})`;
    }
  } catch (error) {
    console.log("Error getting current network:", error);
    return "Unknown";
  }
};
