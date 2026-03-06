import { useState, useEffect, useCallback, useRef } from 'react';
import { contractService } from '@/lib/contract/contractService';
import { TouristStatus, ZoneLevel } from '@/lib/contract/abi';
import { fromContractCoordinate, fromContractTimestamp } from '@/lib/contract/types';
import { useToast } from '@/hooks/use-toast';

interface EmergencyAlertEvent {
  alertId: string;
  tourist: string;
  touristId: string;
  status: number;
  timestamp: Date;
}

interface StatusUpdateEvent {
  tourist: string;
  touristId: string;
  oldStatus: number;
  newStatus: number;
  timestamp: Date;
}

interface DangerZoneEvent {
  zoneId: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: number;
  createdBy: string;
}

export function useContract() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Event callbacks
  const emergencyCallbackRef = useRef<((event: EmergencyAlertEvent) => void) | null>(null);
  const statusCallbackRef = useRef<((event: StatusUpdateEvent) => void) | null>(null);
  const dangerZoneCallbackRef = useRef<((event: DangerZoneEvent) => void) | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await contractService.initialize();
      setIsInitialized(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize contract';
      setError(message);
      toast({
        title: 'Contract Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Auto-initialize when MetaMask is available
  useEffect(() => {
    if (window.ethereum && !isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  // Setup event listeners when initialized
  useEffect(() => {
    if (!isInitialized) return;

    // Emergency Alert listener
    contractService.onEmergencyAlertCreated((alertId, tourist, touristId, status, timestamp) => {
      const event: EmergencyAlertEvent = {
        alertId,
        tourist,
        touristId,
        status,
        timestamp: fromContractTimestamp(timestamp),
      };
      emergencyCallbackRef.current?.(event);
    });

    // Status Update listener
    contractService.onStatusUpdated((tourist, touristId, oldStatus, newStatus, timestamp) => {
      const event: StatusUpdateEvent = {
        tourist,
        touristId,
        oldStatus,
        newStatus,
        timestamp: fromContractTimestamp(timestamp),
      };
      statusCallbackRef.current?.(event);
    });

    // Danger Zone Created listener
    contractService.onDangerZoneCreated((zoneId, name, lat, lng, radius, level, createdBy) => {
      const event: DangerZoneEvent = {
        zoneId,
        name,
        lat: fromContractCoordinate(lat),
        lng: fromContractCoordinate(lng),
        radius: Number(radius),
        level,
        createdBy,
      };
      dangerZoneCallbackRef.current?.(event);
    });

    return () => {
      contractService.removeAllListeners();
    };
  }, [isInitialized]);

  const onEmergencyAlert = useCallback((callback: (event: EmergencyAlertEvent) => void) => {
    emergencyCallbackRef.current = callback;
  }, []);

  const onStatusUpdate = useCallback((callback: (event: StatusUpdateEvent) => void) => {
    statusCallbackRef.current = callback;
  }, []);

  const onDangerZoneAdded = useCallback((callback: (event: DangerZoneEvent) => void) => {
    dangerZoneCallbackRef.current = callback;
  }, []);

  const getOwner = useCallback(async () => {
    try {
      return await contractService.getOwner();
    } catch {
      return null;
    }
  }, []);

  const registerTourist = useCallback(
    async (username: string, email: string, phone: string, dob: Date) => {
      try {
        setIsLoading(true);
        
        toast({ 
          title: 'Registering', 
          description: 'Please confirm transaction in MetaMask' 
        });
        
        const tx = await contractService.registerTourist(username, email, phone, dob);
        toast({ title: 'Transaction Sent', description: 'Registering on blockchain...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Tourist registered on blockchain!' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const updateStatus = useCallback(
    async (status: 'Safe' | 'Alert' | 'Emergency') => {
      try {
        setIsLoading(true);
        const tx = await contractService.updateStatus(status);
        toast({ title: 'Transaction Sent', description: 'Updating status...' });
        await tx.wait();
        toast({ title: 'Success', description: `Status updated to ${status}` });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Status update failed';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const updateLocation = useCallback(
    async (lat: number, lng: number) => {
      try {
        setIsLoading(true);
        const tx = await contractService.updateLocation(lat, lng);
        toast({ title: 'Transaction Sent', description: 'Updating location on blockchain...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Location updated on blockchain' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Location update failed';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const getTourist = useCallback(async (address: string) => {
    try {
      return await contractService.getTourist(address);
    } catch {
      return null;
    }
  }, []);

  const getTouristById = useCallback(async (touristId: string) => {
    try {
      return await contractService.getTouristById(touristId);
    } catch {
      return null;
    }
  }, []);

  const getAllTourists = useCallback(async () => {
    try {
      return await contractService.getAllTourists();
    } catch {
      return [];
    }
  }, []);

  const getTouristCount = useCallback(async () => {
    try {
      return await contractService.getTouristCount();
    } catch {
      return 0;
    }
  }, []);

  const isAdmin = useCallback(async (address: string) => {
    try {
      return await contractService.isAdmin(address);
    } catch {
      return false;
    }
  }, []);

  const getAdmins = useCallback(async () => {
    try {
      return await contractService.getAdmins();
    } catch {
      return [];
    }
  }, []);

  const createDangerZone = useCallback(
    async (name: string, lat: number, lng: number, radius: number, level: 'Low' | 'Medium' | 'High' | 'Critical') => {
      try {
        setIsLoading(true);
        const tx = await contractService.createDangerZone(name, lat, lng, radius, level);
        toast({ title: 'Transaction Sent', description: 'Creating danger zone...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Danger zone created on blockchain!' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create danger zone';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const updateDangerZone = useCallback(
    async (zoneIndex: number, name: string, radius: number, level: 'Low' | 'Medium' | 'High' | 'Critical') => {
      try {
        setIsLoading(true);
        const tx = await contractService.updateDangerZone(zoneIndex, name, radius, level);
        toast({ title: 'Transaction Sent', description: 'Updating danger zone...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Danger zone updated!' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update danger zone';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const removeDangerZone = useCallback(
    async (zoneIndex: number) => {
      try {
        setIsLoading(true);
        const tx = await contractService.removeDangerZone(zoneIndex);
        toast({ title: 'Transaction Sent', description: 'Removing danger zone...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Danger zone removed!' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove danger zone';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const getAllDangerZones = useCallback(async () => {
    try {
      return await contractService.getAllDangerZones();
    } catch {
      return [];
    }
  }, []);

  const getActiveDangerZones = useCallback(async () => {
    try {
      return await contractService.getActiveDangerZones();
    } catch {
      return [];
    }
  }, []);

  const dismissAlert = useCallback(
    async (alertIndex: number) => {
      try {
        setIsLoading(true);
        const tx = await contractService.dismissAlert(alertIndex);
        toast({ title: 'Transaction Sent', description: 'Dismissing alert...' });
        await tx.wait();
        toast({ title: 'Success', description: 'Alert dismissed!' });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to dismiss alert';
        toast({ title: 'Error', description: message, variant: 'destructive' });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const getAllAlerts = useCallback(async () => {
    try {
      return await contractService.getAllAlerts();
    } catch {
      return [];
    }
  }, []);

  const getActiveAlerts = useCallback(async () => {
    try {
      return await contractService.getActiveAlerts();
    } catch {
      return [];
    }
  }, []);

  const getAlertCount = useCallback(async () => {
    try {
      return await contractService.getAlertCount();
    } catch {
      return 0;
    }
  }, []);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    getOwner,
    registerTourist,
    updateStatus,
    updateLocation,
    getTourist,
    getTouristById,
    getAllTourists,
    getTouristCount,
    isAdmin,
    getAdmins,
    createDangerZone,
    updateDangerZone,
    removeDangerZone,
    getAllDangerZones,
    getActiveDangerZones,
    dismissAlert,
    getAllAlerts,
    getActiveAlerts,
    getAlertCount,
    // Event listeners
    onEmergencyAlert,
    onStatusUpdate,
    onDangerZoneAdded,
    getSignerAddress: () => contractService.getSignerAddress(),
    getContractAddress: () => contractService.getContractAddress(),
  };
}
