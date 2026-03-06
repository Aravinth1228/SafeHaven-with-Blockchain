import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  user_id: string;
  tourist_id: string;
  username: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  zone_name?: string | null;
  zone_level?: string | null;
  alert_type?: string;
  dismissed: boolean;
  created_at: string;
}

interface UseRealtimeAlertsOptions {
  onNewAlert?: (alert: Alert) => void;
  onAlertDismissed?: (alert: Alert) => void;
  enabled?: boolean;
}

export function useRealtimeAlerts({
  onNewAlert,
  onAlertDismissed,
  enabled = true,
}: UseRealtimeAlertsOptions = {}) {
  const { toast } = useToast();
  const prevAlertsRef = useRef<Map<string, Alert>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await api.alerts.getActive();
      const currentAlerts = new Map<string, Alert>();
      data.forEach((alert: Alert) => currentAlerts.set(alert.id, alert));

      // Check for new alerts
      currentAlerts.forEach((alert, id) => {
        if (!prevAlertsRef.current.has(id)) {
          // New alert detected
          if (alert.alert_type === 'entered_danger_zone') {
            toast({
              title: '🚨 Danger Zone Alert!',
              description: `${alert.username} entered ${alert.zone_name} (${alert.zone_level} risk)`,
              variant: 'destructive',
            });
          } else {
            toast({
              title: `⚠️ Status Alert: ${alert.status.toUpperCase()}`,
              description: `${alert.username} changed status to ${alert.status}`,
              variant: alert.status === 'danger' ? 'destructive' : 'default',
            });
          }
          onNewAlert?.(alert);
        }
      });

      // Check for dismissed alerts
      prevAlertsRef.current.forEach((prevAlert, id) => {
        if (!currentAlerts.has(id) && prevAlert.dismissed) {
          onAlertDismissed?.(prevAlert);
        }
      });

      prevAlertsRef.current = currentAlerts;
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [onNewAlert, onAlertDismissed, toast]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchAlerts();

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(fetchAlerts, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enabled, fetchAlerts]);

  return {
    refresh: fetchAlerts,
  };
}
