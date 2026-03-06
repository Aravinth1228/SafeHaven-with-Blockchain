import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { blockchainService } from '../lib/blockchainService';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
}

export interface UseBlockchainReturn extends WalletState {
  connectWallet: () => Promise<string>;
  disconnect: () => void;
  signAndRegister: (data: RegisterData) => Promise<any>;
  signAndUpdateStatus: (status: number) => Promise<any>;
  signAndUpdateLocation: (lat: number, lng: number) => Promise<any>;
  checkRegistration: () => Promise<boolean>;
  getNonce: () => Promise<number>;
}

export interface RegisterData {
  username: string;
  email: string;
  phone: string;
  dateOfBirth: number;
}

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const FORWARDER_ADDRESS = import.meta.env.VITE_FORWARDER_ADDRESS || '0x0000000000000000000000000000000000000000';

/**
 * React hook for blockchain interactions
 * Simple direct MetaMask connection with EIP-712 signing
 */
export function useBlockchain(): UseBlockchainReturn {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isConnecting: false,
    error: null
  });

  // Initialize blockchain service on mount
  useEffect(() => {
    const init = async () => {
      try {
        await blockchainService.initialize(CONTRACT_ADDRESS, FORWARDER_ADDRESS);
        console.log('✅ useBlockchain initialized');
      } catch (error: any) {
        console.error('Failed to initialize blockchain:', error);
      }
    };

    init();
  }, []);

  // Check for existing connection
  useEffect(() => {
    const checkExisting = async () => {
      const connected = await blockchainService.isConnected();
      if (connected) {
        const address = await blockchainService.getWalletAddress();
        if (address) {
          setWalletState(prev => ({
            ...prev,
            isConnected: true,
            address
          }));
        }
      }
    };
    checkExisting();
  }, []);

  /**
   * Connect wallet - Direct MetaMask
   */
  const connectWallet = useCallback(async (): Promise<string> => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      console.log('🔗 Connecting wallet...');
      
      // Request account access from MetaMask
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];

      if (accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      const address = accounts[0];
      console.log('✅ Wallet connected:', address);

      // Create provider and set signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await blockchainService.setSigner(signer);

      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        address,
        isConnecting: false
      }));

      return address;
    } catch (error: any) {
      console.error('❌ Wallet connection failed:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet'
      }));
      throw error;
    }
  }, []);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      isConnecting: false,
      error: null
    });
  }, []);

  /**
   * Get current nonce from backend
   */
  const getNonce = useCallback(async (): Promise<number> => {
    const address = await blockchainService.getWalletAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }
    return await blockchainService.getNonce(address);
  }, []);

  /**
   * Check if user is registered on blockchain
   */
  const checkRegistration = useCallback(async (): Promise<boolean> => {
    const address = await blockchainService.getWalletAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }
    return await blockchainService.isRegistered(address);
  }, []);

  /**
   * Sign and submit tourist registration
   */
  const signAndRegister = useCallback(async (data: RegisterData): Promise<any> => {
    const address = await blockchainService.getWalletAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }

    console.log('📝 Starting registration...');
    console.log('Wallet:', address);
    console.log('Data:', data);

    const nonce = await getNonce();
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Sign the message (with contract and forwarder addresses)
    const { signature, message } = await blockchainService.signRegisterTourist(
      data.username,
      data.email,
      data.phone,
      data.dateOfBirth,
      nonce,
      deadline,
      FORWARDER_ADDRESS,
      CONTRACT_ADDRESS
    );

    console.log('✅ Signature created, submitting to backend...');

    // Submit to backend relayer
    return await blockchainService.submitMetaTransaction(
      'register',
      signature,
      message,
      address
    );
  }, [getNonce]);

  /**
   * Sign and submit status update
   */
  const signAndUpdateStatus = useCallback(async (status: number): Promise<any> => {
    const address = await blockchainService.getWalletAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const nonce = await getNonce();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const { signature, message } = await blockchainService.signUpdateStatus(
      status,
      nonce,
      deadline,
      FORWARDER_ADDRESS,
      CONTRACT_ADDRESS
    );

    return await blockchainService.submitMetaTransaction(
      'updateStatus',
      signature,
      message,
      address
    );
  }, [getNonce]);

  /**
   * Sign and submit location update
   */
  const signAndUpdateLocation = useCallback(async (lat: number, lng: number): Promise<any> => {
    const address = await blockchainService.getWalletAddress();
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const nonce = await getNonce();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Convert to contract format (multiply by 1e6)
    const latInt = Math.floor(lat * 1e6);
    const lngInt = Math.floor(lng * 1e6);

    const { signature, message } = await blockchainService.signUpdateLocation(
      latInt,
      lngInt,
      nonce,
      deadline,
      FORWARDER_ADDRESS,
      CONTRACT_ADDRESS
    );

    return await blockchainService.submitMetaTransaction(
      'updateLocation',
      signature,
      message,
      address
    );
  }, [getNonce]);

  return {
    ...walletState,
    connectWallet,
    disconnect,
    signAndRegister,
    signAndUpdateStatus,
    signAndUpdateLocation,
    checkRegistration,
    getNonce
  };
}
