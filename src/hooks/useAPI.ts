import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function useAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const execute = useCallback(
    async <T>(apiCall: () => Promise<{ success: boolean; data?: T; error?: string }>) => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await apiCall();
        if (!result.success) {
          throw new Error(result.error || "API call failed");
        }
        return result.data as T;
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        setError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Users
  const getAllUsers = useCallback(() => execute(api.users.getAll), [execute]);
  const getUserById = useCallback((id: string) => execute(() => api.users.getById(id)), [execute]);
  const updateUserStatus = useCallback(
    (userId: string, status: string) => execute(() => api.users.updateStatus(userId, status)),
    [execute]
  );

  // Danger Zones
  const getDangerZones = useCallback(() => execute(api.dangerZones.getAll), [execute]);
  const createDangerZone = useCallback(
    (zone: { name: string; lat: number; lng: number; radius: number; level: string; created_by?: string }) =>
      execute(() => api.dangerZones.create(zone)),
    [execute]
  );
  const deleteDangerZone = useCallback(
    (zoneId: string) => execute(() => api.dangerZones.delete(zoneId)),
    [execute]
  );

  // Alerts
  const getActiveAlerts = useCallback(() => execute(api.alerts.getActive), [execute]);
  const dismissAlert = useCallback(
    (alertId: string) => execute(() => api.alerts.dismiss(alertId)),
    [execute]
  );

  // Locations
  const updateLocation = useCallback(
    (location: { user_id: string; tourist_id: string; lat: number; lng: number; username?: string }) =>
      execute(() => api.locations.update(location)),
    [execute]
  );

  // Analytics
  const getAnalytics = useCallback(() => execute(api.analytics), [execute]);

  // Health
  const checkHealth = useCallback(() => execute(api.health), [execute]);

  return {
    isLoading,
    error,
    // Users
    getAllUsers,
    getUserById,
    updateUserStatus,
    // Danger Zones
    getDangerZones,
    createDangerZone,
    deleteDangerZone,
    // Alerts
    getActiveAlerts,
    dismissAlert,
    // Locations
    updateLocation,
    // Analytics
    getAnalytics,
    // Health
    checkHealth,
  };
}