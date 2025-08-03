declare global {
  interface Window {
    ethereum?: any;
    chrome?: {
      runtime?: {
        sendMessage?: (extensionId: string, message: any) => void;
      };
    };
  }
}

export {}; 