// app/types/global.d.ts
declare global {
    var walletCredentials: {
      publicKey: PublicKey;
      signTransaction: SignerWalletAdapterProps['signTransaction'];
      signAllTransactions: SignerWalletAdapterProps['signAllTransactions'];
      timestamp: number;
    } | null;
  }
  
  export {};