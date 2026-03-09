import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isMetaMaskInstalled: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  signer: ethers.Signer | null;
  provider: ethers.BrowserProvider | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

/**
 * WalletProvider Component
 * 
 * Simple direct MetaMask wallet connection
 * No RainbowKit, no wagmi - just pure ethers.js
 */
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  useEffect(() => {
    const checkMetaMask = () => {
      const installed = typeof window.ethereum !== 'undefined';
      setIsMetaMaskInstalled(installed);

      if (installed) {
        console.log('✅ MetaMask detected');
      } else {
        console.warn('⚠️ MetaMask not installed');
      }
    };

    checkMetaMask();

    // Check if already connected
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: 'eth_accounts'
          }) as string[];

          if (accounts.length > 0) {
            console.log('✅ Already connected to:', accounts[0]);
            setWalletAddress(accounts[0]);
            const prov = new ethers.BrowserProvider(window.ethereum);
            const sgnr = await prov.getSigner();
            setSigner(sgnr);
            setProvider(prov);
          } else {
            // Check if we have a saved address in localStorage (auto-connect)
            const savedAddress = localStorage.getItem('walletAddress');
            if (savedAddress) {
              console.log('🔄 Auto-connecting to saved wallet:', savedAddress);
              // Try to reconnect to the saved account
              try {
                const newAccounts = await window.ethereum.request({
                  method: 'eth_requestAccounts'
                }) as string[];
                
                if (newAccounts.length > 0) {
                  const address = newAccounts[0];
                  setWalletAddress(address);
                  const prov = new ethers.BrowserProvider(window.ethereum);
                  const sgnr = await prov.getSigner();
                  setSigner(sgnr);
                  setProvider(prov);
                  console.log('✅ Auto-connected to:', address);
                }
              } catch (err) {
                console.log('⚠️ Auto-connect failed, clearing saved address');
                localStorage.removeItem('walletAddress');
              }
            }
          }
        } catch (err) {
          console.error('Error checking existing connection:', err);
        }
      }
    };

    checkConnection();

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: unknown) => {
        const accountsArray = accounts as string[];
        if (accountsArray.length === 0) {
          console.log('🔴 Wallet disconnected');
          setWalletAddress(null);
          setSigner(null);
          setProvider(null);
          localStorage.removeItem('walletAddress');
        } else {
          console.log('✅ Account changed to:', accountsArray[0]);
          setWalletAddress(accountsArray[0]);
          localStorage.setItem('walletAddress', accountsArray[0]);

          // Update signer
          const prov = new ethers.BrowserProvider(window.ethereum);
          prov.getSigner().then(setSigner);
          setProvider(prov);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const connectWallet = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const currentHost = window.location.hostname;
    
    // Encode the current URL for redirect back after wallet connection
    const encodedUrl = encodeURIComponent(`https://${currentHost}`);

    if (!window.ethereum) {
      // MetaMask not installed - redirect to mobile app or download page
      if (isMobile) {
        // MetaMask mobile deep link with universal links
        const metamaskDeepLink = `https://metamask.app.link/dapp/${currentHost}`;
        
        // Try to open MetaMask app
        window.location.href = metamaskDeepLink;
        
        // Fallback: If MetaMask app not installed, redirect to download
        setTimeout(() => {
          window.location.href = 'https://metamask.app.link/download';
        }, 2000);
        
        throw new Error('Opening MetaMask mobile app...');
      } else {
        throw new Error('MetaMask is not installed. Please install it at https://metamask.io');
      }
    }

    setIsConnecting(true);
    try {
      console.log('🔗 Requesting wallet connection...');
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (accounts.length > 0) {
        const address = accounts[0];
        console.log('✅ Wallet connected:', address);

        setWalletAddress(address);
        localStorage.setItem('walletAddress', address);

        // Create provider and signer
        const prov = new ethers.BrowserProvider(window.ethereum);
        const sgnr = await prov.getSigner();
        setSigner(sgnr);
        setProvider(prov);

        console.log('✅ Provider and signer ready');
      }
    } catch (error: any) {
      console.error('❌ Connection failed:', error);
      
      // If user rejected on mobile, try deep link again
      if (isMobile && error.code === 4001) {
        const metamaskDeepLink = `https://metamask.app.link/dapp/${currentHost}`;
        window.location.href = metamaskDeepLink;
        throw new Error('Please approve the connection in MetaMask');
      }
      
      throw new Error(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    console.log('🔴 Wallet disconnected by user');
    setWalletAddress(null);
    setSigner(null);
    setProvider(null);
    localStorage.removeItem('walletAddress');
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected: !!walletAddress,
        isMetaMaskInstalled,
        connectWallet,
        disconnectWallet,
        isConnecting,
        signer,
        provider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
