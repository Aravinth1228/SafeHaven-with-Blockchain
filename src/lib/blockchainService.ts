/**
 * SafeHeaven Blockchain Service
 * Handles ERC-2771 meta-transactions for gasless user interactions
 *
 * Flow:
 * 1. User signs message with MetaMask (NO GAS)
 * 2. Backend verifies signature and submits transaction as relayer
 * 3. Contract identifies real user via _msgSender()
 */

import { ethers } from 'ethers';

// Full Contract ABI from compiled artifact
const TOURIST_SAFETY_ABI = [
  "function registerTourist(string username, string email, string phone, uint256 dateOfBirth) external returns (string)",
  "function updateStatus(uint8 status) external",
  "function updateLocation(int256 latitude, int256 longitude) external",
  "function getTourist(address wallet) external view returns (tuple(string touristId, string username, string email, string phone, uint256 dateOfBirth, uint8 status, uint256 registeredAt, bool isActive, int256 lastLatitude, int256 lastLongitude, uint256 lastLocationUpdate))",
  "function isRegistered(address wallet) external view returns (bool)",
  "function trustedForwarder() external view returns (address)",
  "function isTrustedForwarder(address forwarder) external view returns (bool)",
  "event TouristRegistered(address indexed wallet, string touristId, string username, uint256 timestamp)",
  "event StatusUpdated(address indexed tourist, string touristId, uint8 oldStatus, uint8 newStatus, uint256 timestamp)",
  "event LocationUpdated(address indexed tourist, string touristId, int256 latitude, int256 longitude, uint256 timestamp)"
];

// ForwardRequest type for EIP-712 (matching OpenZeppelin ERC2771Forwarder)
// This MUST match the typehash in ERC2771Forwarder.sol:
// "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
const FORWARD_REQUEST_TYPE = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "gas", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint48" },
  { name: "data", type: "bytes" }
];

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contractAddress: string = '';
  private forwarderAddress: string = '';
  private chainId: number = 0;

  constructor() {}

  /**
   * Initialize the blockchain service
   */
  async initialize(contractAddress: string, forwarderAddress: string): Promise<void> {
    this.contractAddress = contractAddress;
    this.forwarderAddress = forwarderAddress;

    if (!window.ethereum) {
      console.warn('⚠️ MetaMask not installed');
      return;
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    
    // Switch to Sepolia network if not already on it
    const requiredChainId = 11155111; // Sepolia
    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const currentChainId = parseInt(chainIdHex, 16);
      
      if (currentChainId !== requiredChainId) {
        console.log('⚠️ Wrong network detected, switching to Sepolia...');
        console.log('Current chainId:', currentChainId, 'Required:', requiredChainId);
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
          });
          console.log('✅ Switched to Sepolia network');
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            console.log('⚠️ Sepolia not added to MetaMask, adding...');
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${requiredChainId.toString(16)}`,
                chainName: 'Sepolia Testnet',
                nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              }],
            });
            console.log('✅ Sepolia network added');
          } else {
            console.error('❌ Failed to switch network:', switchError);
          }
        }
      } else {
        console.log('✅ Already on Sepolia network');
      }
    } catch (err) {
      console.error('❌ Error checking/switching network:', err);
    }

    // Refresh provider after network switch
    await new Promise(resolve => setTimeout(resolve, 1000));
    const network = await this.provider.getNetwork();
    this.chainId = Number(network.chainId);
    
    console.log('🔗 Final Chain ID:', this.chainId);

    // Check if already connected
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      }) as string[];

      if (accounts.length > 0) {
        console.log('✅ Restoring existing wallet:', accounts[0]);
        this.signer = await this.provider.getSigner();
      }
    } catch (err) {
      console.log('ℹ️ No existing wallet connection');
    }

    console.log('✅ BlockchainService initialized');
    console.log('📝 Contract:', contractAddress);
    console.log('🔗 Forwarder:', forwarderAddress);
    console.log('🔗 Chain ID:', this.chainId);
  }

  /**
   * Ensure signer exists - CRITICAL for reliable signing
   * This is the key fix for "Wallet not connected" errors
   */
  private async ensureSigner(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    if (!this.signer) {
      console.log('🔐 Creating signer - requesting accounts...');
      await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      this.signer = await this.provider.getSigner();
      console.log('✅ Signer created:', await this.signer.getAddress());
    }
  }

  /**
   * Set signer from WalletContext
   */
  async setSigner(newSigner: ethers.Signer): Promise<void> {
    this.signer = newSigner;
    
    // Refresh chainId from the signer's provider to ensure it's current
    if (newSigner.provider) {
      const network = await newSigner.provider.getNetwork();
      this.chainId = Number(network.chainId);
      console.log('✅ Signer set, chainId refreshed:', this.chainId);
    }
    
    const address = await this.signer.getAddress();
    console.log('✅ Signer set:', address);
  }

  /**
   * Check if wallet is connected
   */
  async isConnected(): Promise<boolean> {
    if (!window.ethereum) return false;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current wallet address
   */
  async getWalletAddress(): Promise<string | null> {
    try {
      await this.ensureSigner();
      return await this.signer!.getAddress();
    } catch {
      return null;
    }
  }

  /**
   * Get current signer
   */
  getSigner(): ethers.Signer | null {
    return this.signer;
  }

  /**
   * Get domain separator for EIP-712 (using Forwarder contract)
   * IMPORTANT: OpenZeppelin ERC2771Forwarder uses hardcoded name "ERC2771Forwarder"
   * NOT the custom name passed to the constructor!
   */
  private async getDomainSeparator(): Promise<ethers.TypedDataDomain> {
    // CRITICAL: Get chainId directly from MetaMask to ensure it matches what the user sees
    let chainIdFromMetaMask: number;
    try {
      const chainIdHex = await window.ethereum!.request({ method: 'eth_chainId' }) as string;
      chainIdFromMetaMask = parseInt(chainIdHex, 16);
      console.log('🔐 getDomainSeparator - chainId from MetaMask:', chainIdFromMetaMask);
    } catch (err) {
      console.error('❌ Failed to get chainId from MetaMask, using cached:', err);
      chainIdFromMetaMask = this.chainId;
    }

    return {
      name: 'ERC2771Forwarder',  // MUST be exactly "ERC2771Forwarder" for OpenZeppelin
      version: '1',
      chainId: chainIdFromMetaMask,  // Use chainId directly from MetaMask
      verifyingContract: this.forwarderAddress
    };
  }

  /**
   * Sign register tourist message using EIP-712 (ForwardRequest type for ERC2771)
   */
  async signRegisterTourist(
    username: string,
    email: string,
    phone: string,
    dateOfBirth: number,
    nonce: number,
    deadline: number,
    forwarderAddress: string,
    contractAddress: string
  ): Promise<{ signature: string; message: any }> {
    await this.ensureSigner();

    // CRITICAL: Refresh chainId right before signing to ensure it matches current network
    if (this.signer?.provider) {
      const network = await this.signer.provider.getNetwork();
      this.chainId = Number(network.chainId);
      console.log('🔐 signRegisterTourist - Refreshed chainId:', this.chainId);
    }

    const domain = await this.getDomainSeparator();
    const userAddress = await this.signer!.getAddress();

    // Encode the function call data for registerTourist (WITH function selector)
    const registerInterface = new ethers.Interface([
      "function registerTourist(string username, string email, string phone, uint256 dateOfBirth) external returns (string)"
    ]);
    const registerData = registerInterface.encodeFunctionData('registerTourist', [
      username, email, phone, BigInt(dateOfBirth)
    ]);

    // Create ForwardRequest message (matching ERC2771Forwarder)
    const message = {
      from: userAddress,
      to: contractAddress,
      value: 0n,
      gas: 300000n,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      data: registerData
    };

    console.log('🔐 Signing EIP-712 ForwardRequest...');
    console.log('Domain:', domain);
    console.log('ForwardRequest:', message);
    console.log('🔐 chainId being used for signing:', this.chainId);

    const signature = await this.signer!.signTypedData(
      domain,
      { ForwardRequest: FORWARD_REQUEST_TYPE },
      message
    );

    console.log('✅ Signature created:', signature);
    return { signature, message };
  }

  /**
   * Sign update status message using EIP-712 (ForwardRequest type for ERC2771)
   */
  async signUpdateStatus(
    status: number,
    nonce: number,
    deadline: number,
    forwarderAddress: string,
    contractAddress: string
  ): Promise<{ signature: string; message: any }> {
    await this.ensureSigner();

    // CRITICAL: Refresh chainId right before signing
    if (this.signer?.provider) {
      const network = await this.signer.provider.getNetwork();
      this.chainId = Number(network.chainId);
      console.log('🔐 signUpdateStatus - Refreshed chainId:', this.chainId);
    }

    const domain = await this.getDomainSeparator();
    const userAddress = await this.signer!.getAddress();

    // Encode the function call data for updateStatus (WITH function selector)
    const statusInterface = new ethers.Interface([
      "function updateStatus(uint8 status) external"
    ]);
    const statusData = statusInterface.encodeFunctionData('updateStatus', [status]);

    const message = {
      from: userAddress,
      to: contractAddress,
      value: 0n,
      gas: 100000n,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      data: statusData
    };

    const signature = await this.signer!.signTypedData(
      domain,
      { ForwardRequest: FORWARD_REQUEST_TYPE },
      message
    );

    return { signature, message };
  }

  /**
   * Sign update location message using EIP-712 (ForwardRequest type for ERC2771)
   */
  async signUpdateLocation(
    latitude: number,
    longitude: number,
    nonce: number,
    deadline: number,
    forwarderAddress: string,
    contractAddress: string
  ): Promise<{ signature: string; message: any }> {
    await this.ensureSigner();

    // CRITICAL: Refresh chainId right before signing
    if (this.signer?.provider) {
      const network = await this.signer.provider.getNetwork();
      this.chainId = Number(network.chainId);
      console.log('🔐 signUpdateLocation - Refreshed chainId:', this.chainId);
    }

    const domain = await this.getDomainSeparator();
    const userAddress = await this.signer!.getAddress();

    // Encode the function call data for updateLocation (WITH function selector)
    const locationInterface = new ethers.Interface([
      "function updateLocation(int256 latitude, int256 longitude) external"
    ]);
    const locationData = locationInterface.encodeFunctionData('updateLocation', [
      BigInt(latitude), BigInt(longitude)
    ]);

    const message = {
      from: userAddress,
      to: contractAddress,
      value: 0n,
      gas: 100000n,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      data: locationData
    };

    const signature = await this.signer!.signTypedData(
      domain,
      { ForwardRequest: FORWARD_REQUEST_TYPE },
      message
    );

    return { signature, message };
  }

  /**
   * Check if user is registered on blockchain
   */
  async isRegistered(walletAddress: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const contract = new ethers.Contract(this.contractAddress, TOURIST_SAFETY_ABI, this.provider);
    return await contract.isRegistered(walletAddress);
  }

  /**
   * Get tourist info from blockchain
   */
  async getTouristInfo(walletAddress: string): Promise<any | null> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const contract = new ethers.Contract(this.contractAddress, TOURIST_SAFETY_ABI, this.provider);
    try {
      const tourist = await contract.getTourist(walletAddress);
      if (!tourist.isActive) return null;
      return tourist;
    } catch {
      return null;
    }
  }

  /**
   * Get current nonce from backend
   */
  async getNonce(walletAddress: string): Promise<number> {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/blockchain/nonce?wallet=${walletAddress}`);
    const data = await response.json();
    return data.nonce;
  }

  /**
   * Submit signed transaction to backend relayer
   */
  async submitMetaTransaction(
    action: 'register' | 'updateStatus' | 'updateLocation',
    signature: string,
    message: any,
    walletAddress: string
  ): Promise<any> {
    console.log('📡 Submitting meta-transaction to backend...');
    console.log('Action:', action);
    console.log('Wallet:', walletAddress);
    console.log('Message:', message);

    // Convert BigInt values to strings for JSON serialization
    // EXCEPT deadline (uint48) which must stay as Number for backend verification
    const serializedMessage = {
      from: message.from,
      to: message.to,
      value: message.value?.toString(),
      gas: message.gas?.toString(),
      nonce: message.nonce?.toString(),
      deadline: Number(message.deadline),  // uint48 must be Number, not string
      data: message.data
    };

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/blockchain/meta-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        signature,
        message: serializedMessage,
        wallet: walletAddress
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Transaction failed');
    }

    console.log('✅ Meta-transaction submitted:', result);
    return result;
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
