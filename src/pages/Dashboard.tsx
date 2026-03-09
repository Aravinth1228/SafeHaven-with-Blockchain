import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, AlertTriangle, Shield, Navigation, Bell, CheckCircle,
  Loader2, Eye, EyeOff, Radio, Activity, ShieldCheck, ShieldAlert,
  X, User, LogOut, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useContract } from '@/hooks/useContract';
import { useToast } from '@/hooks/use-toast';
import LeafletMap from '@/components/LeafletMap';
import { useDangerZoneDetection } from '@/hooks/useDangerZoneDetection';
import { api } from '@/lib/api';
import { useBlockchainDangerZones } from '@/hooks/useBlockchainDangerZones';
import { useSocket } from '@/hooks/useSocket';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  tourist_id: string;
  user_id: string;
  admin_wallet: string;
  message: string;
  notification_type: string;
  read: boolean;
  created_at: string;
}

interface CurrentPlace {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Proper Haversine distance in meters */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDirection(uLat: number, uLng: number, zLat: number, zLng: number): string {
  const y = Math.sin((zLng - uLng) * Math.PI / 180) * Math.cos(zLat * Math.PI / 180);
  const x = Math.cos(uLat * Math.PI / 180) * Math.sin(zLat * Math.PI / 180) -
    Math.sin(uLat * Math.PI / 180) * Math.cos(zLat * Math.PI / 180) * Math.cos((zLng - uLng) * Math.PI / 180);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return dirs[Math.round(((bearing + 360) % 360) / 45)];
}

function getSafeDirection(uLat: number, uLng: number, zLat: number, zLng: number): string {
  const opp: Record<string, string> = { N:'S', S:'N', E:'W', W:'E', NE:'SW', SW:'NE', SE:'NW', NW:'SE' };
  return opp[getDirection(uLat, uLng, zLat, zLng)] || 'away';
}

// ─── Component ────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, updateStatus, logout } = useAuth();
  const { walletAddress } = useWallet();
  const { isInitialized, initialize } = useContract();

  // Location state
  const [location, setLocation]               = useState<{ lat: number; lng: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [currentPlace, setCurrentPlace]       = useState<CurrentPlace | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const [isOnline, setIsOnline]               = useState(navigator.onLine);
  const [isTracking, setIsTracking]           = useState(true);

  // GPS accuracy averaging — collect 3 readings, pick best
  const gpsReadingsRef = useRef<GeolocationPosition[]>([]);
  const gpsReadyRef    = useRef(false);

  // Status
  const [status, setStatus] = useState<'safe' | 'alert' | 'danger'>('safe');
  const statusRef = useRef<'safe' | 'alert' | 'danger'>('safe');
  useEffect(() => { statusRef.current = status; }, [status]);

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications]         = useState<Notification[]>([]);

  // Other users on map (socket-driven, no polling)
  const [allUsersLocations, setAllUsersLocations] = useState<Array<{
    touristId: string; username: string; lat: number; lng: number;
    status: 'safe' | 'alert' | 'danger'; lastSeen?: Date;
  }>>([]);

  // Danger zones
  const { zones: blockchainDangerZones, fetchDangerZones: fetchBlockchainZones } = useBlockchainDangerZones();
  const [dangerZones, setDangerZones] = useState<Array<{
    id: string; name: string; lat: number; lng: number; radius: number; level: 'low' | 'medium' | 'high';
  }>>([]);

  // ── Online / Offline detection ─────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  toast({ title: '🌐 Back Online', description: 'Location tracking resumed.', duration: 3000 }); };
    const onOffline = () => { setIsOnline(false); toast({ title: '📡 Offline', description: 'No internet. Location paused.', variant: 'destructive', duration: 5000 }); };
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [toast]);

  // ── Danger zones (blockchain, refresh every 30s) ───────────────────────────
  useEffect(() => {
    const load = async () => {
      const zones = await fetchBlockchainZones();
      setDangerZones(zones.map((z: any) => ({
        id: z.zoneId || z.id,
        name: z.name,
        lat: z.lat,
        lng: z.lng,
        radius: z.radius,
        level: (() => {
          const l = (z.level || '').toLowerCase();
          if (l === 'critical' || l === 'high') return 'high';
          if (l === 'medium') return 'medium';
          return 'low';
        })() as 'low' | 'medium' | 'high',
      })));
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [fetchBlockchainZones]);

  // ── Sync status from user profile ─────────────────────────────────────────
  useEffect(() => {
    if (user?.status) setStatus(user.status as any);
  }, [user?.status]);

  // ── Socket.IO — real-time location updates (NO polling) ───────────────────
  const { isConnected, getSocket } = useSocket({
    enabled: isAuthenticated && !!user?.touristId,
    touristId: user?.touristId,
    onMyLocationUpdate: (data) => {
      setLastLocationUpdate(new Date(data.updated_at));
    },
    onLocationUpdate: (data) => {
      // Update other users list via socket push — no 3s poll needed
      setAllUsersLocations(prev => {
        const idx = prev.findIndex(u => u.touristId === data.tourist_id);
        const entry = {
          touristId: data.tourist_id,
          username:  data.username || 'Unknown',
          lat:    data.lat,
          lng:    data.lng,
          status: (data.status || 'safe') as 'safe' | 'alert' | 'danger',
          lastSeen: new Date(),
        };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = entry;
          return updated;
        }
        return [...prev, entry];
      });
    },
  });

  // Initial fetch of all locations (once on mount — then socket keeps it fresh)
  useEffect(() => {
    const init = async () => {
      try {
        const result = await api.locations.getAll();
        if (result.data) {
          setAllUsersLocations(result.data.map((loc: any) => ({
            touristId: loc.tourist_id,
            username:  loc.username || 'Unknown',
            lat:    loc.lat,
            lng:    loc.lng,
            status: (loc.status || 'safe') as 'safe' | 'alert' | 'danger',
            lastSeen: loc.updated_at ? new Date(loc.updated_at) : new Date(),
          })));
        }
      } catch {}
    };
    init();
  }, []);

  // ── Send location via Socket (when location changes — smart throttle) ──────
  const lastSentRef = useRef<{ lat: number; lng: number; status: string; ts: number } | null>(null);

  useEffect(() => {
    if (!location || !user?.id || !user?.touristId || !isTracking || !isOnline) return;

    const send = () => {
      const socket = getSocket();
      if (!socket?.connected) return;

      const now  = Date.now();
      const last = lastSentRef.current;
      const movedEnough = !last ||
        haversineDistance(last.lat, last.lng, location.lat, location.lng) > 5 ||
        now - last.ts > 5000 ||
        statusRef.current !== last.status;

      if (!movedEnough) return;

      socket.emit('location-update', {
        user_id:    user.id,
        tourist_id: user.touristId,
        lat:        location.lat,
        lng:        location.lng,
        username:   user.username || 'Unknown',
        status:     statusRef.current,
        updated_at: new Date().toISOString(),
      });

      lastSentRef.current = { lat: location.lat, lng: location.lng, status: statusRef.current, ts: now };
      setLastLocationUpdate(new Date());
    };

    send(); // immediate
    const t = setInterval(send, 5000);
    return () => clearInterval(t);
  }, [location, status, user?.id, user?.touristId, user?.username, isTracking, isOnline, getSocket]);

  // ── Danger zone detection (Haversine — correct formula) ───────────────────
  const { nearestZone } = useDangerZoneDetection(
    location, user?.touristId || '', user?.username || '', user?.id, dangerZones
  );

  useEffect(() => {
    if (!location || dangerZones.length === 0) return;

    let newStatus: 'safe' | 'alert' | 'danger' = 'safe';
    let triggerZone: typeof dangerZones[0] | null = null;

    for (const zone of dangerZones) {
      const dist = haversineDistance(location.lat, location.lng, zone.lat, zone.lng);
      if (dist <= zone.radius) {
        newStatus = 'danger';
        triggerZone = zone;
        break;
      }
      if (dist <= zone.radius * 1.5) {
        newStatus = 'alert';
        triggerZone = zone;
      }
    }

    if (newStatus === 'danger' && status !== 'danger') {
      setStatus('danger');
      toast({ title: '🚨 EMERGENCY!', description: `Inside "${triggerZone?.name}"! Exit immediately!`, variant: 'destructive', duration: 10000 });
    } else if (newStatus === 'alert' && status === 'safe') {
      setStatus('alert');
      toast({ title: '⚠️ WARNING!', description: `Approaching "${triggerZone?.name}". Proceed with caution.`, duration: 8000 });
    } else if (newStatus === 'safe' && (status === 'danger' || status === 'alert')) {
      setStatus('safe');
      toast({ title: '✅ You are Safe!', description: 'Left the danger zone.', duration: 5000 });
    }
  }, [location, dangerZones]);

  // ── GPS Location tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation || !user?.id || !user?.touristId) return;

    let watchId: number | null = null;

    // Accuracy threshold — reject anything worse than this
    // Desktop/WiFi: ~1-5km | Urban GPS: 10-50m | Open sky GPS: 3-10m
    const MAX_ACCEPTABLE_ACCURACY = 5000; // 5km — allow WiFi location for desktop users

    const applyReading = (lat: number, lng: number, accuracy: number) => {
      setLocation({ lat, lng });
      setLocationAccuracy(accuracy);
      setLocationPermission('granted');
      setCurrentPlace({ lat, lng });

      if (accuracy <= 50) {
        toast({ title: '📍 GPS Locked', description: `±${Math.round(accuracy)}m — Excellent accuracy!`, duration: 3000 });
      } else if (accuracy <= 150) {
        toast({ title: '📍 Location Active', description: `±${Math.round(accuracy)}m — Go outdoors for better accuracy.`, duration: 6000 });
      } else if (accuracy <= 500) {
        toast({ title: '⚠️ Weak GPS Signal', description: `±${Math.round(accuracy)}m — Move to open area.`, duration: 8000 });
      } else if (accuracy <= 5000) {
        toast({ title: '📶 WiFi Location', description: `±${Math.round(accuracy / 1000)}km — Using network location (desktop/indoor)`, duration: 8000 });
      }
    };

    const applyBestReading = (positions: GeolocationPosition[]) => {
      // Filter out garbage readings (IP/WiFi approximations)
      const goodReadings = positions.filter(p => p.coords.accuracy <= MAX_ACCEPTABLE_ACCURACY);

      if (goodReadings.length === 0) {
        // All readings are trash — keep retrying via watchPosition
        console.warn('⚠️ All initial readings too inaccurate — waiting for GPS lock via watchPosition');
        toast({
          title: '📡 Waiting for GPS…',
          description: 'Poor signal. Move outdoors and wait a few seconds.',
          duration: 8000,
        });
        return; // don't setLocation — map stays in "Acquiring" state
      }

      const best = goodReadings.reduce((a, b) =>
        a.coords.accuracy < b.coords.accuracy ? a : b
      );
      applyReading(best.coords.latitude, best.coords.longitude, best.coords.accuracy);

      api.locations.update({
        user_id: user.id, tourist_id: user.touristId,
        lat: best.coords.latitude, lng: best.coords.longitude,
        username: user.username || 'Unknown', status: statusRef.current,
      }).catch(() => {});
    };

    const startTracking = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          console.log(`📍 GPS: ±${Math.round(accuracy)}m`);

          if (accuracy > MAX_ACCEPTABLE_ACCURACY) {
            // Still no GPS — show acquiring banner, update accuracy display only
            setLocationAccuracy(accuracy);
            console.warn(`⚠️ Still waiting for GPS lock: ±${Math.round(accuracy)}m`);
            return; // don't setLocation — keep map in "Acquiring" state
          }

          applyReading(lat, lng, accuracy);
        },
        (err) => {
          console.error('watchPosition error:', err.code, err.message);
          if (err.code === err.PERMISSION_DENIED) setLocationPermission('denied');
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    };

    const init = async () => {
      try {
        if ('permissions' in navigator) {
          const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (perm.state === 'denied') {
            setLocationPermission('denied');
            toast({ title: '📍 Location Denied', description: 'Enable location in browser settings.', variant: 'destructive', duration: 10000 });
            return;
          }
        }

        // Try collecting up to 3 readings, filter by accuracy
        const readings: GeolocationPosition[] = [];
        const MAX_READINGS = 3;
        const MAX_WAIT_MS  = 12000;
        const startTime    = Date.now();

        // watchPosition will keep trying — no looping getCurrentPosition needed
        // Just start watching immediately with high accuracy
        startTracking();
      } catch (e) {
        startTracking();
      }
    };

    init();
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [user?.id, user?.touristId, user?.username]);

  // ── Notifications ──────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user?.touristId) return;
    try {
      const r = await api.notifications.getForUser(user.touristId);
      if (r.data) setNotifications(r.data);
    } catch {}
  }, [user?.touristId]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 10000); // reduced from 5s → 10s
    return () => clearInterval(t);
  }, [loadNotifications]);

  const markNotificationAsRead = async (id: string) => {
    await api.notifications.markRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await api.notifications.markRead(id).catch(() => {});
  };

  const markAllNotificationsAsRead = async () => {
    await Promise.all(notifications.filter(n => !n.read).map(n => api.notifications.markRead(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleStatusChange = async (newStatus: 'safe' | 'alert' | 'danger') => {
    try {
      await updateStatus(newStatus);
      setStatus(newStatus);
      const msgs = {
        safe:   { title: 'Status Updated',   desc: 'You are marked as SAFE' },
        alert:  { title: 'Alert Requested',  desc: 'Help has been notified' },
        danger: { title: 'Emergency Alert!', desc: 'Emergency services dispatched' },
      };
      toast({ title: msgs[newStatus].title, description: msgs[newStatus].desc, variant: newStatus === 'danger' ? 'destructive' : 'default' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Last seen formatter ────────────────────────────────────────────────────
  const fmtLastSeen = (d: Date | null) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 5)  return 'Just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  // No blocking loading screen — dashboard opens immediately
  const MAX_ACCEPTABLE_ACCURACY = 500; // meters — same as GPS tracking logic

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">

        {/* ── GPS Acquiring Banner (non-blocking) ── */}
        {!location && (
          <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 border ${
            locationPermission === 'denied'
              ? 'bg-destructive/10 border-destructive/30'
              : locationAccuracy && locationAccuracy > MAX_ACCEPTABLE_ACCURACY
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-primary/10 border-primary/30'
          }`}>
            {locationPermission === 'denied'
              ? <span className="text-xl">🚫</span>
              : <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
            }
            <div className="flex-1">
              {locationPermission === 'denied' ? (
                <>
                  <p className="text-sm font-semibold text-destructive">Location Permission Denied</p>
                  <p className="text-xs text-muted-foreground">Browser settings → 🔒 → Location → Allow → Refresh page</p>
                </>
              ) : locationAccuracy && locationAccuracy > MAX_ACCEPTABLE_ACCURACY ? (
                <>
                  <p className="text-sm font-semibold text-yellow-400">📡 Waiting for GPS lock… (±{Math.round(locationAccuracy / 1000)}km signal)</p>
                  <p className="text-xs text-muted-foreground">Phone-ல் use பண்ணுங்க — outdoors போனா 5-10s-ல் lock ஆகும்</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-primary">📍 Getting GPS location…</p>
                  <p className="text-xs text-muted-foreground">Map will appear once GPS locks on</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                status === 'safe'   ? 'bg-green-500/20 border-green-500' :
                status === 'alert'  ? 'bg-yellow-500/20 border-yellow-500' :
                                     'bg-red-500/20 border-red-500'
              }`}>
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">{user?.username || 'Tourist'}</h2>
                  {/* Online/offline badge */}
                  {isOnline
                    ? <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full"><Wifi className="w-3 h-3" /> Online</span>
                    : <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full"><WifiOff className="w-3 h-3" /> Offline</span>
                  }
                  {/* Socket badge */}
                  {isConnected
                    ? <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">🔴 Live</span>
                    : <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">⚡ Reconnecting</span>
                  }
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {location
                    ? <span className="font-mono text-xs">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                    : <span className="text-xs italic text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Acquiring GPS…</span>
                  }
                  {locationAccuracy && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      locationAccuracy <= 20  ? 'bg-green-500/20 text-green-400' :
                      locationAccuracy <= 100 ? 'bg-blue-500/20 text-blue-400' :
                                               'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      ±{Math.round(locationAccuracy)}m
                    </span>
                  )}
                  {lastLocationUpdate && (
                    <span className="text-[10px] text-muted-foreground">{fmtLastSeen(lastLocationUpdate)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { logout(); navigate('/login'); }}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Status Buttons ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['safe', 'alert', 'danger'] as const).map(s => {
            const cfg = {
              safe:   { active: 'bg-green-600 hover:bg-green-500 shadow-green-500/30',  inactive: 'bg-green-600/20 hover:bg-green-600/30 text-green-400',  icon: <CheckCircle className="w-6 h-6 mr-2" />,  label: 'SAFE'   },
              alert:  { active: 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-500/30', inactive: 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400', icon: <AlertTriangle className="w-6 h-6 mr-2" />, label: 'ALERT'  },
              danger: { active: 'bg-red-600 hover:bg-red-500 shadow-red-500/30 animate-pulse', inactive: 'bg-red-600/20 hover:bg-red-600/30 text-red-400',       icon: <ShieldAlert className="w-6 h-6 mr-2" />,   label: 'DANGER' },
            }[s];
            return (
              <Button key={s} onClick={() => handleStatusChange(s)}
                className={`h-20 text-lg font-bold transition-all ${status === s ? cfg.active + ' scale-105 shadow-lg' : cfg.inactive}`}>
                {cfg.icon}{cfg.label}
              </Button>
            );
          })}
        </div>

        {/* ── GPS Accuracy Warning ── */}
        {locationAccuracy && locationAccuracy > 100 && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
            <span className="text-xl">📡</span>
            <div>
              <p className="text-sm font-semibold text-yellow-400">Poor GPS Accuracy (±{Math.round(locationAccuracy)}m)</p>
              <p className="text-xs text-muted-foreground">Location may be wrong. Enable GPS / go outdoors.</p>
            </div>
          </div>
        )}

        {/* ── Current Status Card ── */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                status === 'safe' ? 'bg-green-500/20' : status === 'alert' ? 'bg-yellow-500/20' : 'bg-red-500/20'
              }`}>
                {status === 'safe' ? '✅' : status === 'alert' ? '⚠️' : '🚨'}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <p className={`text-2xl font-bold ${
                  status === 'safe' ? 'text-green-400' : status === 'alert' ? 'text-yellow-400' : 'text-red-400'
                }`}>{status.toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-2">Nearest Danger Zone</p>
              {nearestZone ? (
                <div>
                  <p className="text-lg font-semibold text-destructive">{nearestZone.zone.name}</p>
                  <p className="text-sm text-muted-foreground">{(nearestZone.distance / 1000).toFixed(2)} km away</p>
                  {nearestZone.distance <= 500 && location && (
                    <div className="mt-2 p-2 rounded-lg bg-destructive/20 border border-destructive/50">
                      <p className="text-xs text-destructive font-semibold">
                        ⚠️ Go {getSafeDirection(location.lat, location.lng, nearestZone.zone.lat, nearestZone.zone.lng)} to avoid!
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-success">No nearby danger zones</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Live Map ── */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              Live Location Tracking
              {isTracking && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-success/20 text-success flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
                </span>
              )}
            </h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              locationAccuracy && locationAccuracy <= 20  ? 'bg-green-500/10 border-green-500/30' :
              locationAccuracy && locationAccuracy <= 100 ? 'bg-primary/10 border-primary/20' :
                                                           'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {location
                ? <span className="text-xs font-mono font-semibold">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                : <span className="text-xs text-muted-foreground italic flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Acquiring…</span>
              }
              <span className="text-[10px] text-muted-foreground">
                {locationAccuracy ? `±${Math.round(locationAccuracy)}m` : '…'}
              </span>
            </div>
          </div>

          <div className="h-[420px] rounded-xl overflow-hidden">
            {location ? (
              <LeafletMap
                dangerZones={dangerZones}
                userLocations={allUsersLocations.filter(u => u.touristId !== user?.touristId)}
                currentUserLocation={{ lat: location.lat, lng: location.lng, status, accuracy: locationAccuracy ?? undefined }}
                showDangerZones={true}
                showUserMarkers={true}
                isAdmin={false}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-muted/20 rounded-xl border border-border gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Acquiring GPS signal…</p>
                <p className="text-xs text-muted-foreground">Go outdoors for better accuracy</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className={`w-4 h-4 ${isTracking ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
              {isTracking ? 'Location sharing active' : 'Location sharing paused'}
              {lastLocationUpdate && isTracking && (
                <span className="text-xs text-muted-foreground">· {fmtLastSeen(lastLocationUpdate)}</span>
              )}
            </div>
            <Button onClick={() => setIsTracking(!isTracking)} variant="outline" size="sm" className="gap-2">
              {isTracking ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isTracking ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>

        {/* ── Safety Features ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Safety Status</h3>
                <p className="text-sm text-muted-foreground">Real-time monitoring</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Danger Zones Nearby</span>
                <span className={`font-semibold ${nearestZone ? 'text-destructive' : 'text-success'}`}>
                  {nearestZone ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Location Sharing</span>
                <div className="flex items-center gap-2">
                  <Radio className={`w-3 h-3 ${isTracking ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
                  <span className={`font-semibold text-xs ${isTracking ? 'text-success' : 'text-muted-foreground'}`}>
                    {isTracking ? 'Active' : 'Paused'}
                  </span>
                  {lastLocationUpdate && isTracking && (
                    <span className="text-xs text-muted-foreground">{fmtLastSeen(lastLocationUpdate)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">GPS Accuracy</span>
                <span className={`font-semibold text-xs ${
                  !locationAccuracy ? 'text-muted-foreground' :
                  locationAccuracy <= 20  ? 'text-green-400' :
                  locationAccuracy <= 100 ? 'text-blue-400' : 'text-yellow-400'
                }`}>
                  {locationAccuracy ? `±${Math.round(locationAccuracy)}m` : 'Acquiring…'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`font-semibold ${
                  status === 'safe' ? 'text-green-400' : status === 'alert' ? 'text-yellow-400' : 'text-red-400'
                }`}>{status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Quick Actions</h3>
                <p className="text-sm text-muted-foreground">Emergency tools</p>
              </div>
            </div>
            <div className="space-y-3">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Shield className="w-4 h-4" /> Emergency Contacts
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline"
                disabled={!location}
                onClick={() => {
                  if (!location) return;
                  const url = `https://maps.google.com/?q=${location.lat},${location.lng}`;
                  if (navigator.share) {
                    navigator.share({ title: 'My Location', url });
                  } else {
                    navigator.clipboard.writeText(url);
                    toast({ title: '📋 Copied!', description: 'Location link copied to clipboard.' });
                  }
                }}>
                <MapPin className="w-4 h-4" /> Share My Location
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <Bell className="w-4 h-4" /> Request Assistance
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Notifications Panel ── */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button onClick={markAllNotificationsAsRead} variant="ghost" size="sm" className="text-xs">
                    Mark All Read
                  </Button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${n.read ? 'bg-muted/20 border-border/50' : 'bg-primary/10 border-primary/30'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${n.read ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              n.notification_type === 'danger' || n.notification_type === 'evacuation' ? 'bg-destructive/20 text-destructive' :
                              n.notification_type === 'warning' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'
                            }`}>{n.notification_type.toUpperCase()}</span>
                            <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="p-1 hover:bg-destructive/20 rounded transition-colors">
                            <X className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                        <p className="text-sm">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">From: {n.admin_wallet.slice(0, 10)}…</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;