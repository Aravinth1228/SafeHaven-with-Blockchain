import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  AlertTriangle,
  Shield,
  Navigation,
  Bell,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Radio,
  Activity,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  X,
  User,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useContract } from '@/hooks/useContract';
import { useToast } from '@/hooks/use-toast';
import LeafletMap from '@/components/LeafletMap';
import { useDangerZoneDetection } from '@/hooks/useDangerZoneDetection';
import { api } from '@/lib/api';
import { useBlockchainLocationUpdate } from '@/hooks/useBlockchainLocationUpdate';

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

interface DangerZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: string;
}

interface CurrentPlace {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

// Calculate direction from user to danger zone
function getDirection(userLat: number, userLng: number, zoneLat: number, zoneLng: number): string {
  const dLat = zoneLat - userLat;
  const dLng = zoneLng - userLng;
  
  // Calculate bearing
  const y = Math.sin(dLng * Math.PI / 180) * Math.cos(zoneLat * Math.PI / 180);
  const x = Math.cos(userLat * Math.PI / 180) * Math.sin(zoneLat * Math.PI / 180) -
            Math.sin(userLat * Math.PI / 180) * Math.cos(zoneLat * Math.PI / 180) * Math.cos(dLng * Math.PI / 180);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Convert bearing to direction
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round((bearing + 360) % 360 / 45);
  
  return directions[index];
}

// Get opposite direction (safe direction)
function getSafeDirection(userLat: number, userLng: number, zoneLat: number, zoneLng: number): string {
  const dangerDir = getDirection(userLat, userLng, zoneLat, zoneLng);
  const opposites: Record<string, string> = {
    'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E',
    'NE': 'SW', 'SW': 'NE', 'SE': 'NW', 'NW': 'SE'
  };
  return opposites[dangerDir] || 'away';
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, updateStatus, logout } = useAuth();
  const { walletAddress } = useWallet();
  const { isInitialized, initialize } = useContract();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentPlace, setCurrentPlace] = useState<CurrentPlace | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // Local status state
  const [status, setStatus] = useState<'safe' | 'alert' | 'danger'>('safe');

  // Sync status from backend on mount
  useEffect(() => {
    const syncStatus = async () => {
      if (!user?.touristId) return;
      
      try {
        const result = await api.users.getAll();
        const currentUser = result.data?.find((u: any) => u.tourist_id === user.touristId);
        
        if (currentUser && currentUser.status !== status) {
          setStatus(currentUser.status as 'safe' | 'alert' | 'danger');
        }
      } catch (error) {
        console.error('Error syncing status:', error);
      }
    };
    
    syncStatus();
  }, [user?.touristId]);

  useEffect(() => {
    if (user?.status) {
      setStatus(user.status as any);
    }
  }, [user?.status]);

  // Send location to backend AND blockchain
  useBlockchainLocationUpdate({
    userId: user?.id || '',
    touristId: user?.touristId || '',
    status: status,
    username: user?.username,
    isInitialized,
    initialize,
  });

  const { nearestZone } = useDangerZoneDetection(
    location,
    user?.touristId || '',
    user?.username || '',
    user?.id
  );

  const loadDangerZones = useCallback(async () => {
    try {
      const result = await api.dangerZones.getAll();
      if (result.data) {
        setDangerZones(result.data);
      }
    } catch (error) {
      console.error('Error loading danger zones:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.touristId) return;
    try {
      const result = await api.notifications.getForUser(user.touristId);
      if (result.data) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [user?.touristId]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    loadDangerZones();
    loadNotifications();
    
    // Poll for new notifications every 5 seconds
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadDangerZones, loadNotifications]);

  // Get current location
  useEffect(() => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        setLocation({ lat, lng });
        setLocationPermission('granted');
        
        // Fetch place name using reverse geocoding (OpenStreetMap Nominatim)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await response.json();
          
          setCurrentPlace({
            address: data.address?.road || data.address?.neighbourhood || '',
            city: data.address?.city || data.address?.town || data.address?.village || '',
            state: data.address?.state || '',
            country: data.address?.country || '',
          });
        } catch (error) {
          console.error('Error fetching place name:', error);
        }
      },
      (err) => {
        console.error('Location error:', err);
        setLocationPermission('denied');
        toast({
          title: 'Location Access Denied',
          description: 'Please enable location access for full functionality.',
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [toast]);

  const handleStatusChange = async (newStatus: 'safe' | 'alert' | 'danger') => {
    try {
      await updateStatus(newStatus);
      setStatus(newStatus);

      const statusMessages = {
        safe: { title: 'Status Updated', desc: 'You are marked as SAFE', icon: '✅' },
        alert: { title: 'Alert Requested', desc: 'Help has been notified', icon: '⚠️' },
        danger: { title: 'Emergency Alert!', desc: 'Emergency services dispatched', icon: '🚨' },
      };

      toast({
        title: statusMessages[newStatus].title,
        description: statusMessages[newStatus].desc,
        variant: newStatus === 'danger' ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      // Mark as read in backend (API doesn't have delete endpoint yet)
      await api.notifications.markRead(id);
      
      toast({
        title: 'Notification Deleted',
        description: 'The notification has been removed.',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await Promise.all(
        notifications.filter(n => !n.read).map(n => api.notifications.markRead(n.id))
      );
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatMapDangerZones = dangerZones.map(zone => ({
    id: zone.id,
    name: zone.name,
    lat: zone.lat,
    lng: zone.lng,
    radius: zone.radius,
    level: (zone.level as 'low' | 'medium' | 'high') || 'medium',
  }));

  if (!location) {
    return (
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header with User Info */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{user?.username || 'Tourist'}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {currentPlace ? (
                    <span>
                      {currentPlace.address && <span>{currentPlace.address}, </span>}
                      {currentPlace.city && <span>{currentPlace.city}, </span>}
                      {currentPlace.state || currentPlace.country || 'Location available'}
                    </span>
                  ) : (
                    <span>Getting location...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status Buttons */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Button
            onClick={() => handleStatusChange('safe')}
            className={`h-20 text-lg font-bold transition-all ${
              status === 'safe'
                ? 'bg-green-600 hover:bg-green-500 scale-105 shadow-lg shadow-green-500/30'
                : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
            }`}
          >
            <CheckCircle className="w-6 h-6 mr-2" />
            SAFE
          </Button>

          <Button
            onClick={() => handleStatusChange('alert')}
            className={`h-20 text-lg font-bold transition-all ${
              status === 'alert'
                ? 'bg-yellow-600 hover:bg-yellow-500 scale-105 shadow-lg shadow-yellow-500/30'
                : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
            }`}
          >
            <AlertTriangle className="w-6 h-6 mr-2" />
            ALERT
          </Button>

          <Button
            onClick={() => handleStatusChange('danger')}
            className={`h-20 text-lg font-bold transition-all ${
              status === 'danger'
                ? 'bg-red-600 hover:bg-red-500 scale-105 shadow-lg shadow-red-500/30 animate-pulse'
                : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
            }`}
          >
            <ShieldAlert className="w-6 h-6 mr-2" />
            DANGER
          </Button>
        </div>

        {/* Current Status Display */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                status === 'safe' ? 'bg-green-500/20' :
                status === 'alert' ? 'bg-yellow-500/20' : 'bg-red-500/20'
              }`}>
                {status === 'safe' ? '✅' : status === 'alert' ? '⚠️' : '🚨'}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <p className={`text-2xl font-bold ${
                  status === 'safe' ? 'text-green-400' :
                  status === 'alert' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {status.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-2">Nearest Danger Zone</p>
              {nearestZone ? (
                <div>
                  <p className="text-lg font-semibold text-destructive">{nearestZone.zone.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(nearestZone.distance / 1000).toFixed(2)} km away
                  </p>
                  {nearestZone.distance <= 500 && (
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

        {/* Live Tracking Map */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Live Location Tracking
            {isTracking && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-success/20 text-success flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </h2>
          <div className="h-[400px] rounded-xl overflow-hidden">
            <LeafletMap
              dangerZones={formatMapDangerZones}
              currentUserLocation={{
                lat: location.lat,
                lng: location.lng,
                status: status,
              }}
              showDangerZones={true}
              showUserMarkers={false}
              isAdmin={false}
            />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className={`w-4 h-4 ${isTracking ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
              {isTracking ? 'Location sharing active' : 'Location sharing paused'}
            </div>
            <Button
              onClick={() => setIsTracking(!isTracking)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isTracking ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isTracking ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>

        {/* Safety Features */}
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
                <span className={`font-semibold ${isTracking ? 'text-success' : 'text-muted-foreground'}`}>
                  {isTracking ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`font-semibold ${
                  status === 'safe' ? 'text-green-400' :
                  status === 'alert' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {status.toUpperCase()}
                </span>
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
                <Shield className="w-4 h-4" />
                Emergency Contacts
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <MapPin className="w-4 h-4" />
                Share My Location
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline">
                <Bell className="w-4 h-4" />
                Request Assistance
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
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
                  <Button
                    onClick={markAllNotificationsAsRead}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Mark All Read
                  </Button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No notifications yet</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      notification.read
                        ? 'bg-muted/20 border-border/50'
                        : 'bg-primary/10 border-primary/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        notification.read ? 'bg-muted-foreground' : 'bg-primary animate-pulse'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              notification.notification_type === 'danger' || notification.notification_type === 'evacuation'
                                ? 'bg-destructive/20 text-destructive'
                                : notification.notification_type === 'warning'
                                ? 'bg-warning/20 text-warning'
                                : 'bg-primary/20 text-primary'
                            }`}>
                              {notification.notification_type.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(notification.created_at).toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 hover:bg-destructive/20 rounded transition-colors"
                            title="Delete notification"
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                        <p className="text-sm">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          From: {notification.admin_wallet.slice(0, 10)}...
                        </p>
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
