import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/contexts/WalletContext';
import { ethers } from 'ethers';

interface DangerZone {
  id: string;
  blockchainIndex: number;
  zoneId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
}

interface BlockchainStatus {
  initialized: boolean;
  network: string;
  chainId: number;
  contractAddress: string;
  forwarderAddress: string;
  relayerAddress: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Hook for managing danger zones on blockchain only (no MongoDB)
 */
export const useBlockchainDangerZones = () => {
  const { toast } = useToast();
  const { walletAddress, provider, signer } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [zones, setZones] = useState<DangerZone[]>([]);
  const [blockchainStatus, setBlockchainStatus] = useState<BlockchainStatus | null>(null);

  /**
   * Check blockchain connection status
   */
  const checkBlockchainStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/blockchain/status`);
      const data = await response.json();
      
      if (data.success) {
        setBlockchainStatus({
          initialized: data.initialized,
          network: data.network,
          chainId: data.chainId,
          contractAddress: data.contractAddress,
          forwarderAddress: data.forwarderAddress,
          relayerAddress: data.relayerAddress
        });
        return data;
      }
      throw new Error(data.error || 'Failed to get blockchain status');
    } catch (error) {
      console.error('Error checking blockchain status:', error);
      return null;
    }
  }, []);

  /**
   * Get all danger zones from blockchain
   */
  const fetchDangerZones = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/blockchain/danger-zones`);
      const data = await response.json();
      
      if (data.success) {
        setZones(data.data || []);
        return data.data;
      }
      throw new Error(data.error || 'Failed to fetch danger zones');
    } catch (error) {
      console.error('Error fetching danger zones:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch danger zones from blockchain',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  /**
   * Get active danger zones only
   */
  const fetchActiveDangerZones = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/blockchain/danger-zones/active`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      }
      throw new Error(data.error || 'Failed to fetch active danger zones');
    } catch (error) {
      console.error('Error fetching active danger zones:', error);
      return [];
    }
  }, []);

  /**
   * Create danger zone on blockchain (admin wallet pays gas)
   */
  const createDangerZone = useCallback(async (zoneData: {
    name: string;
    lat: number;
    lng: number;
    radius: number;
    level: 'Low' | 'Medium' | 'High' | 'Critical';
  }) => {
    if (!walletAddress) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your admin wallet first',
        variant: 'destructive'
      });
      return null;
    }

    setIsLoading(true);
    try {
      // Convert coordinates to int256 * 1e6 format
      const latInt = Math.round(zoneData.lat * 1e6);
      const lngInt = Math.round(zoneData.lng * 1e6);

      // Get current nonce
      const nonceResponse = await fetch(`${API_BASE}/blockchain/nonce?wallet=${walletAddress}`);
      const nonceData = await nonceResponse.json();
      const nonce = nonceData.nonce;

      // Get deployment info for contract addresses
      const deploymentResponse = await fetch(`${API_BASE}/blockchain/deployment-info`);
      const deploymentData = await deploymentResponse.json();
      
      if (!deploymentData.success) {
        throw new Error('Failed to get deployment info');
      }

      const contractAddress = deploymentData.data.contracts.TouristSafetyERC2771.address;
      const forwarderAddress = deploymentData.data.contracts.TrustedForwarder.address;
      const chainId = deploymentData.data.chainId;

      // Create contract interface
      const contractInterface = new ethers.Interface([
        "function createDangerZone(string name, int256 latitude, int256 longitude, uint256 radius, uint8 level) external returns (string)"
      ]);

      // Encode function data
      const levelMap = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 };
      const encodedData = contractInterface.encodeFunctionData('createDangerZone', [
        zoneData.name,
        latInt,
        lngInt,
        zoneData.radius,
        levelMap[zoneData.level]
      ]);

      // Create EIP-712 domain
      const domain = {
        name: 'SafeHeaven Trusted Forwarder',
        version: '1',
        chainId: chainId,
        verifyingContract: forwarderAddress
      };

      // Create EIP-712 types
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      };

      // Create forward request
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const forwardRequest = {
        from: walletAddress,
        to: contractAddress,
        value: 0,
        gas: 300000,
        nonce: nonce,
        deadline: deadline,
        data: encodedData
      };

      // Sign the request
      if (!signer) {
        throw new Error('No signer available');
      }

      const signature = await signer.signTypedData(domain, types, forwardRequest);

      // Send to backend for relaying
      const response = await fetch(`${API_BASE}/blockchain/danger-zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: zoneData.name,
          lat: zoneData.lat,
          lng: zoneData.lng,
          radius: zoneData.radius,
          level: zoneData.level,
          created_by: walletAddress,
          signature: signature,
          message: forwardRequest
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Danger Zone Created!',
          description: `Zone "${zoneData.name}" has been added to the blockchain`,
        });

        // Refresh zones list
        await fetchDangerZones();

        return result.data;
      } else {
        throw new Error(result.error || 'Failed to create danger zone');
      }
    } catch (error: any) {
      console.error('Error creating danger zone:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create danger zone on blockchain',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, signer, toast, fetchDangerZones]);

  /**
   * Remove danger zone from blockchain
   */
  const removeDangerZone = useCallback(async (zoneIndex: number) => {
    if (!walletAddress) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your admin wallet first',
        variant: 'destructive'
      });
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/blockchain/danger-zones/${zoneIndex}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_wallet: walletAddress
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Danger Zone Removed!',
          description: 'Zone has been removed from the blockchain',
        });

        // Refresh zones list
        await fetchDangerZones();

        return true;
      } else {
        throw new Error(result.error || 'Failed to remove danger zone');
      }
    } catch (error: any) {
      console.error('Error removing danger zone:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove danger zone from blockchain',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, toast, fetchDangerZones]);

  /**
   * Get zone count
   */
  const getZoneCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/blockchain/danger-zones/count`);
      const data = await response.json();
      
      if (data.success) {
        return data.data.count;
      }
      return 0;
    } catch (error) {
      console.error('Error getting zone count:', error);
      return 0;
    }
  }, []);

  return {
    zones,
    isLoading,
    blockchainStatus,
    checkBlockchainStatus,
    fetchDangerZones,
    fetchActiveDangerZones,
    createDangerZone,
    removeDangerZone,
    getZoneCount,
    refreshZones: fetchDangerZones
  };
};
