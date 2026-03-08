import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MapPin,
  AlertTriangle,
  Shield,
  Bell,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  LogOut,
  Wallet,
  Loader2,
  RefreshCw,
  Database,
  Send,
  MessageSquare,
  X,
  Edit2,
  Eraser
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useContract } from '@/hooks/useContract';
import { contractService } from '@/lib/contract/contractService';
import { useToast } from '@/hooks/use-toast';
import MapLibreMap from '@/components/MapLibreMap';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { useRealtimeLocations } from '@/hooks/useRealtimeLocations';
import { useRealtimeProfiles } from '@/hooks/useRealtimeProfiles';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { fromContractTimestamp } from '@/lib/contract/types';

interface Profile {
  id?: string;
  user_id: string;
  tourist_id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  wallet_address?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface Alert {
  id: string;
  user_id: string;
  tourist_id: string;
  username: string | null;
  status: string | null;
  lat?: number | null;
  lng?: number | null;
  zone_name?: string | null;
  zone_level?: string | null;
  alert_type?: string | null;
  dismissed: boolean;
  created_at?: string | null;
}

interface DangerZone {
  id: string;
  blockchainIndex?: number;  // Index on blockchain
  zoneId?: string;           // Zone ID from blockchain
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: string | null;
  isActive?: boolean;        // Whether zone is active on blockchain
  created_at?: string;
}

interface UserLocation {
  id?: string;
  user_id: string;
  tourist_id: string;
  lat: number;
  lng: number;
  status?: string;
  updated_at?: string;
}

// Helper to parse UTC timestamps
const parseUTC = (ts: string): Date => {
  if (!ts) return new Date();
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z';
  return new Date(normalized);
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { adminLogout } = useAuth();
  const { disconnectWallet, walletAddress } = useWallet();
  const { getAllTourists, getAllTouristAddresses, getAllAlerts, getAllDangerZones, isInitialized, initialize, deleteTourist } = useContract();

  // API Data State
  const [users, setUsers] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', lat: '', lng: '', radius: '', level: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical' });
  const [showAddZone, setShowAddZone] = useState(false);
  const [editingZone, setEditingZone] = useState<DangerZone | null>(null);
  const [showEditZone, setShowEditZone] = useState(false);
  const [editZoneData, setEditZoneData] = useState({ name: '', radius: '', level: '' });

  // Notification state
  const [notifyTarget, setNotifyTarget] = useState<Profile | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyType, setNotifyType] = useState<'info' | 'warning' | 'danger' | 'evacuation'>('warning');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // Load data from Blockchain
  const loadData = useCallback(async () => {
    try {
      console.log('🔄 Loading admin dashboard data...', testMode ? '(TEST MODE - Local Only)' : '(Blockchain + Local)');

      let blockchainTourists = [];

      // Only fetch blockchain data if NOT in test mode
      if (!testMode && isInitialized) {
        try {
          // Try to get all tourists from blockchain (admin only)
          blockchainTourists = await getAllTourists();
          console.log('📊 Blockchain tourists loaded:', blockchainTourists.length);
        } catch (error) {
          console.log('⚠️ Cannot fetch blockchain data, using local only...');
        }
      } else if (!testMode && !isInitialized) {
        // Initialize contract if needed
        await initialize();
        try {
          blockchainTourists = await getAllTourists();
          console.log('📊 Blockchain tourists loaded:', blockchainTourists.length);
        } catch (error) {
          console.log('⚠️ Cannot fetch blockchain data');
        }
      } else {
        console.log('🧪 TEST MODE: Skipping blockchain data');
      }

      // Convert blockchain tourists to Profile format
      const profilesFromBlockchain: Profile[] = blockchainTourists.map(tourist => ({
        user_id: tourist.touristId,
        tourist_id: tourist.touristId,
        username: tourist.username,
        email: tourist.email,
        phone: tourist.phone,
        dob: tourist.dob ? new Date(Number(tourist.dob) * 1000).toISOString() : null,
        wallet_address: null, // Will be filled below
        status: tourist.status === 0 ? 'safe' : tourist.status === 1 ? 'alert' : 'danger',
        created_at: tourist.registeredAt ? new Date(Number(tourist.registeredAt) * 1000).toISOString() : new Date().toISOString(),
      }));

      // Get wallet addresses from blockchain events
      if (!testMode && isInitialized) {
        try {
          const addresses = await getAllTouristAddresses();
          console.log('📍 Tourist addresses from events:', addresses.length);

          // Match addresses with profiles
          addresses.forEach(addr => {
            const profile = profilesFromBlockchain.find(p => {
              // Try to match by checking if this address has this touristId
              return true; // We'll set all addresses
            });
            if (profile && !profile.wallet_address) {
              profile.wallet_address = addr;
            }
          });
        } catch (error) {
          console.error('Error getting addresses:', error);
        }
      }

      // Get from API
      const [usersData, alertsData, zonesData, locationsData] = await Promise.all([
        api.users.getAll(),
        api.alerts.getActive(),
        api.blockchainDangerZones.getAll(),
        api.locations.getAll(),
      ]);

      // Merge data based on testMode
      const apiProfiles = usersData?.data || [];
      const apiLocations = locationsData?.data || [];

      // Create a map to avoid duplicates
      const userMap = new Map<string, Profile>();

      // Add API profiles first
      apiProfiles.forEach((p: Profile) => {
        userMap.set(p.tourist_id, p);
      });

      // Add blockchain profiles only if NOT in test mode
      if (!testMode) {
        profilesFromBlockchain.forEach(p => {
          if (!userMap.has(p.tourist_id)) {
            userMap.set(p.tourist_id, p);
          }
        });
      }

      const mergedUsers = Array.from(userMap.values());

      // No filtering - show all users including test users
      const filteredUsers = mergedUsers;

      console.log('📊 Total users loaded:', filteredUsers.length);

      // Merge locations with user data
      const locationsWithUsers = apiLocations.map((loc: UserLocation) => {
        const user = filteredUsers.find(u => u.tourist_id === loc.tourist_id);
        return {
          ...loc,
          status: user?.status || loc.status || 'safe',
        };
      });

      console.log('📊 Data loaded:', {
        users: filteredUsers.length,
        alerts: alertsData?.data?.length || 0,
        zones: zonesData?.data?.length || 0,
        locations: locationsWithUsers.length,
        testMode: testMode,
      });

      setUsers(filteredUsers);
      setAlerts(alertsData?.data || []);
      setDangerZones(zonesData?.data || []);
      setUserLocations(locationsWithUsers);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data. Make sure backend is running.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, isInitialized, initialize, getAllTourists, testMode]);

  // Realtime alerts subscription (polling)
  useRealtimeAlerts({
    onNewAlert: (newAlert) => {
      setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
    },
    onAlertDismissed: (dismissedAlert) => {
      setAlerts(prev => prev.filter(a => a.id !== dismissedAlert.id));
    },
    enabled: true,
  });

  // Realtime locations subscription (polling) - Keep as fallback
  useRealtimeLocations({
    onLocationsLoaded: (locations) => {
      console.log('📍 Locations loaded:', locations.length);
      setUserLocations(locations);
    },
    onLocationUpdate: (location) => {
      console.log('📍 Location update:', location.tourist_id, location.lat, location.lng);
      setUserLocations(prev => {
        const existingIndex = prev.findIndex(l => l.user_id === location.user_id || l.tourist_id === location.tourist_id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = location;
          return updated;
        }
        return [...prev, location];
      });
    },
    enabled: true,
  });

  // 🚀 REAL-TIME SOCKET.IO LOCATION UPDATES
  useSocket({
    enabled: true,
    isAdmin: true,
    onLocationUpdate: (location) => {
      console.log('⚡ Real-time socket location update:', location.username, location.address);
      setUserLocations(prev => {
        const existingIndex = prev.findIndex(l => l.user_id === location.user_id || l.tourist_id === location.tourist_id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lat: location.lat,
            lng: location.lng,
            status: location.status,
            address: location.address,  // Update address
            updated_at: location.updated_at,
          };
          return updated;
        }
        return [...prev, location];
      });
    },
  });

  // Realtime profiles subscription (polling)
  useRealtimeProfiles({
    onNewProfile: (profile) => {
      setUsers(prev => [profile, ...prev.filter(u => u.user_id !== profile.user_id)]);
      toast({
        title: '👤 New Tourist Registered!',
        description: `${profile.username} (${profile.tourist_id}) has registered.`,
      });
    },
    onProfileUpdated: (profile) => {
      setUsers(prev => {
        const updated = prev.map(u => 
          u.tourist_id === profile.tourist_id ? { ...u, status: profile.status, updated_at: profile.updated_at } : u
        );
        return updated;
      });
      
      if (profile.status === 'safe') {
        toast({
          title: '✅ User Status Updated',
          description: `${profile.username} is now SAFE`,
        });
      } else if (profile.status === 'alert') {
        toast({
          title: '⚠️ User Status Updated',
          description: `${profile.username} requested ALERT`,
          variant: 'default',
        });
      } else if (profile.status === 'danger') {
        toast({
          title: '🚨 User Status Updated',
          description: `${profile.username} is in DANGER!`,
          variant: 'destructive',
        });
      }
    },
    enabled: true,
  });

  // Check admin auth and load data
  useEffect(() => {
    const checkAdminAuth = async () => {
      const isAdmin = localStorage.getItem('isAdmin');
      if (isAdmin !== 'true') {
        navigate('/admin-login');
        return;
      }
      await loadData();
    };
    
    checkAdminAuth();
  }, [navigate, loadData]);

  const handleLogout = () => {
    adminLogout();
    disconnectWallet();
    toast({
      title: 'Logged Out',
      description: 'You have been logged out successfully.',
    });
    navigate('/admin-login');
  };

  const dismissAlert = async (alertId: string) => {
    if (!alertId) {
      toast({
        title: 'Error',
        description: 'Invalid alert ID.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await api.alerts.dismiss(alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast({
        title: 'Alert Dismissed',
        description: 'The alert has been dismissed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to dismiss alert.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (user: Profile) => {
    if (!confirm(`Delete ${user.username} from blockchain?\n\n⚠️ This action cannot be undone!\n\nThe user will be permanently removed from the blockchain.`)) {
      return;
    }

    try {
      // Check if user has wallet address
      if (!user.wallet_address) {
        toast({
          title: 'Error',
          description: 'Cannot delete: Wallet address not available',
          variant: 'destructive',
        });
        return;
      }

      console.log('🗑️ Deleting user from blockchain:', user.wallet_address);

      // Call API to delete tourist from blockchain
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/blockchain/danger-zones/delete-tourist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: user.wallet_address,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state
        setUsers(prev => prev.filter(u => u.user_id !== user.user_id));

        toast({
          title: 'User Deleted',
          description: `${user.username} has been deleted from blockchain.`,
        });

        // Reload data to reflect changes
        setTimeout(() => loadData(), 1000);
      } else {
        throw new Error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('⚠️ CLEAR ALL DATABASE?\n\nThis will:\n- Delete ALL users from MongoDB\n- Remove ALL alerts\n- Clear ALL locations\n- Delete ALL notifications\n- Remove ALL danger zones from MongoDB\n\n⚠️ Blockchain data will NOT be affected (users and zones on blockchain are permanent).\n\nContinue?')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/clear-db`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        console.log('🗑️ Database cleared:', result.deleted);

        toast({
          title: '🗑️ Database Cleared',
          description: `Deleted: ${result.deleted.profiles} users, ${result.deleted.alerts} alerts, ${result.deleted.locations} locations, ${result.deleted.notifications} notifications`,
        });

        // Reload data to reflect changes
        setTimeout(() => loadData(), 1000);
      } else {
        throw new Error('Failed to clear database');
      }
    } catch (error) {
      console.error('Clear database error:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear database',
        variant: 'destructive',
      });
    }
  };

  const addDangerZone = async () => {
    if (!newZone.name || !newZone.lat || !newZone.lng || !newZone.radius) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create danger zone on blockchain via API
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/blockchain/danger-zones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newZone.name,
          lat: parseFloat(newZone.lat),
          lng: parseFloat(newZone.lng),
          radius: parseFloat(newZone.radius),
          level: newZone.level,
          created_by: walletAddress || 'admin',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh danger zones from blockchain after creation
        await loadData();

        setNewZone({ name: '', lat: '', lng: '', radius: '', level: 'Medium' });
        setShowAddZone(false);

        toast({
          title: 'Danger Zone Added to Blockchain',
          description: `${newZone.name} has been stored on the blockchain.`,
        });
      } else {
        throw new Error(result.error || 'Failed to add danger zone');
      }
    } catch (error) {
      console.error('Create error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add danger zone to blockchain.',
        variant: 'destructive',
      });
    }
  };

  const removeDangerZone = async (id: string) => {
    if (!id) {
      toast({
        title: 'Error',
        description: 'Invalid zone ID.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this danger zone? This will mark it as inactive on the blockchain.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Find the zone and get its blockchain index
      const zone = dangerZones.find(z => z.id === id);
      
      console.log('🔍 Zone to delete:', zone);

      // Use blockchainIndex if available, otherwise try to parse from zoneId
      let blockchainIndex = zone?.blockchainIndex;

      if (blockchainIndex === undefined && zone?.zoneId) {
        // Try to extract index from zoneId format "ZONE-1", "ZONE-2", etc.
        const match = zone.zoneId.match(/ZONE-(\d+)/i);
        if (match) {
          blockchainIndex = parseInt(match[1]) - 1; // Convert to 0-based index
        }
      }

      // If still undefined, try to use the index from the id itself
      if (blockchainIndex === undefined && id) {
        const match = id.match(/zone-(\d+)/i);
        if (match) {
          blockchainIndex = parseInt(match[1]);
        }
      }

      console.log('📍 Blockchain index for delete:', blockchainIndex);

      if (blockchainIndex === undefined || isNaN(blockchainIndex)) {
        toast({
          title: 'Error',
          description: 'Cannot determine blockchain index for this zone.',
          variant: 'destructive',
        });
        return;
      }

      console.log('🗑️ Deleting danger zone at blockchain index:', blockchainIndex);
      const response = await api.blockchainDangerZones.delete(blockchainIndex);

      // Refresh danger zones from blockchain after deletion
      await loadData();

      // Check if zone was already inactive (idempotent delete)
      if (response.data?.alreadyInactive) {
        toast({
          title: 'Zone Already Removed',
          description: 'This danger zone was already removed from blockchain.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Zone Removed from Blockchain',
          description: 'Danger zone has been successfully removed from blockchain.',
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove danger zone.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEditZone = (zone: DangerZone) => {
    setEditingZone(zone);
    setEditZoneData({
      name: zone.name,
      radius: zone.radius.toString(),
      level: zone.level || 'Medium'
    });
    setShowEditZone(true);
  };

  const updateZone = async () => {
    if (!editingZone) return;

    try {
      const blockchainIndex = editingZone.blockchainIndex;

      if (blockchainIndex === undefined) {
        toast({
          title: 'Error',
          description: 'Cannot update: Blockchain index not available',
          variant: 'destructive',
        });
        return;
      }

      // Call API to update danger zone on blockchain
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/blockchain/danger-zones/${blockchainIndex}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editZoneData.name,
          radius: parseInt(editZoneData.radius),
          level: editZoneData.level,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh danger zones from blockchain after update
        await loadData();

        setShowEditZone(false);
        setEditingZone(null);

        toast({
          title: 'Zone Updated',
          description: 'Danger zone has been updated on blockchain.',
        });
      } else {
        throw new Error(result.error || 'Failed to update zone');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update danger zone.',
        variant: 'destructive',
      });
    }
  };

  const sendNotification = async () => {
    if (!notifyTarget || !notifyMessage.trim()) return;

    setIsSendingNotification(true);
    try {
      await api.notifications.send({
        tourist_id: notifyTarget.tourist_id,
        user_id: notifyTarget.user_id,
        admin_wallet: walletAddress || 'admin',
        message: notifyMessage.trim(),
        notification_type: notifyType,
      });

      toast({
        title: 'Notification Sent',
        description: `Alert sent to ${notifyTarget.username}.`,
      });

      setNotifyTarget(null);
      setNotifyMessage('');
      setNotifyType('warning');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send notification.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingNotification(false);
    }
  };

  // Registered tourists - Only show users from blockchain or MongoDB, NOT from alerts only
  const displayUsers = users.length > 0 ? users : [];

  // Format locations for map
  const mapLocations = (() => {
    const merged: Record<string, { touristId: string; username: string; lat: number; lng: number; status: 'safe' | 'alert' | 'danger'; address?: string }> = {};

    console.log('📍 Formatting map locations from userLocations:', userLocations.length);

    for (const loc of userLocations) {
      if (!loc.lat || !loc.lng) {
        console.log('⚠️ Skipping location without coordinates:', loc);
        continue;
      }
      
      const profile = displayUsers.find(u => u.tourist_id === loc.tourist_id);
      const statusFromProfile = profile?.status as 'safe' | 'alert' | 'danger';
      
      merged[loc.tourist_id] = {
        touristId: loc.tourist_id,
        username: profile?.username || loc.username || loc.tourist_id,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,  // Include address for map display
        status: statusFromProfile || (loc.status || 'safe') as 'safe' | 'alert' | 'danger',
      };
      
      console.log('✅ Added user to map:', merged[loc.tourist_id]);
    }

    const latestAlertPerTourist: Record<string, Alert> = {};
    for (const a of alerts) {
      if (a.lat == null || a.lng == null) continue;
      const prev = latestAlertPerTourist[a.tourist_id];
      if (!prev || new Date(a.created_at ?? 0) > new Date(prev.created_at ?? 0)) {
        latestAlertPerTourist[a.tourist_id] = a;
      }
    }
    for (const a of Object.values(latestAlertPerTourist)) {
      if (merged[a.tourist_id]) {
        merged[a.tourist_id].status = (a.status || 'safe') as 'safe' | 'alert' | 'danger';
      } else {
        merged[a.tourist_id] = {
          touristId: a.tourist_id,
          username: a.username ?? a.tourist_id,
          lat: a.lat!,
          lng: a.lng!,
          status: (a.status || 'safe') as 'safe' | 'alert' | 'danger',
        };
      }
    }

    const result = Object.values(merged);
    console.log('🗺️ Total users on map:', result.length);
    return result;
  })();

  // Stats
  const statsTotal = displayUsers.length;
  const statsSafe = displayUsers.filter(u => u.status === 'safe').length;
  const statsAlert = displayUsers.filter(u => u.status === 'alert').length;
  const statsDanger = displayUsers.filter(u => u.status === 'danger').length;

  // Format danger zones for map
  const mapDangerZones = dangerZones.map(zone => ({
    id: zone.id,
    name: zone.name,
    lat: zone.lat,
    lng: zone.lng,
    radius: zone.radius,
    level: (zone.level as 'low' | 'medium' | 'high') || 'medium',
  }));

  const getLevelColor = (level: string | null) => {
    switch (level) {
      case 'low': case 'Low': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'medium': case 'Medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'high': case 'High': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Critical': return 'bg-red-600/30 text-red-300 border-red-600/50';
      default: return 'bg-muted';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state - show empty dashboard with refresh button
  if (!users && !alerts && !dangerZones) {
    return (
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground mb-4">Failed to load data from backend</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">
              Admin <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Danger Zones stored on Blockchain • Real-time updates enabled
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setTestMode(!testMode);
                toast({
                  title: testMode ? '🔗 Blockchain Mode' : '🧪 Test Mode',
                  description: testMode ? 'Loading from blockchain' : 'Ignoring blockchain data (local only)',
                });
                loadData();
              }}
              variant={testMode ? "destructive" : "outline"}
              size="sm"
              className="gap-2"
              title={testMode ? 'Switch to Blockchain Mode' : 'Switch to Test Mode (Ignore Blockchain)'}
            >
              {testMode ? '🧪 Test Mode' : '🔗 Blockchain'}
            </Button>
            <Button
              onClick={() => {
                loadData();
                toast({
                  title: 'Refreshing...',
                  description: 'Dashboard data is being refreshed.',
                });
              }}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              onClick={handleClearDatabase}
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive border-destructive/50"
              title="Clear all MongoDB database"
            >
              <Eraser className="w-4 h-4" />
              Clear DB
            </Button>
            <Button
              onClick={async () => {
                if (!confirm('⚠️ DELETE TEST USERS PERMANENTLY?\n\nThis will:\n- Delete ALL test users from MongoDB\n- Remove their locations\n- Delete their alerts and notifications\n- Remove their blockchain profiles\n\nThis action CANNOT be undone!\n\nContinue?')) {
                  return;
                }

                try {
                  const response = await fetch('http://localhost:3000/api/users/delete-test-users?confirm=true', {
                    method: 'DELETE',
                  });

                  const result = await response.json();

                  if (result.success) {
                    toast({
                      title: `🗑️ Deleted ${result.deleted} Test Users`,
                      description: result.message,
                      variant: 'default',
                    });
                    loadData(); // Reload data
                  } else {
                    toast({
                      title: 'Error',
                      description: result.error,
                      variant: 'destructive',
                    });
                  }
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: 'Failed to delete test users',
                    variant: 'destructive',
                  });
                }
              }}
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive border-destructive/50"
              title="Delete all test users permanently"
            >
              <Trash2 className="w-4 h-4" />
              Delete Test Users
            </Button>
            <Button
              onClick={() => {
                if (!confirm('⚠️ DELETE ALL LOCAL USERS?\n\nThis will:\n- Delete users from localStorage\n- Remove all locations\n- Clear all sessions\n\nBlockchain users will remain (permanent).\n\nContinue?')) {
                  return;
                }

                console.log('🗑️ Deleting all local users...\n');

                // Delete users from localStorage
                localStorage.removeItem('users');
                console.log('✅ Removed: users');

                // Remove all user locations
                Object.keys(localStorage).forEach(key => {
                  if (key.startsWith('userLocation-')) {
                    localStorage.removeItem(key);
                    console.log(`✅ Removed: ${key}`);
                  }
                });

                // Clear current user
                localStorage.removeItem('currentUser');
                console.log('✅ Removed: currentUser');

                // Clear admin session
                localStorage.removeItem('adminWalletAddress');
                localStorage.removeItem('isAdmin');
                console.log('✅ Removed: admin session');

                // Clear wallet
                localStorage.removeItem('walletAddress');
                console.log('✅ Removed: walletAddress');

                toast({
                  title: '🗑️ Users Deleted',
                  description: 'All local users deleted. Refreshing...',
                });

                setTimeout(() => window.location.reload(), 1000);
              }}
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive border-destructive/50"
              title="Delete all local users"
            >
              <Trash2 className="w-4 h-4" />
              Delete Local
            </Button>
            {walletAddress && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            )}
            <Button onClick={handleLogout} variant="outline" className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsTotal}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsSafe}</p>
                <p className="text-sm text-muted-foreground">Safe</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsAlert}</p>
                <p className="text-sm text-muted-foreground">Alert</p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsDanger}</p>
                <p className="text-sm text-muted-foreground">Emergency</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Map */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Live User Tracking Map
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-success/20 text-success flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live
            </span>
          </h2>
          <div className="h-[400px] rounded-xl overflow-hidden">
            <MapLibreMap
              dangerZones={mapDangerZones}
              userLocations={mapLocations}
              showDangerZones={true}
              showUserMarkers={true}
              isAdmin={true}
            />
          </div>
        </div>

        {/* Database Alerts - Real-time */}
        {alerts.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-6 border-2 border-destructive/50">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              Active Alerts
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-destructive/20 text-destructive">
                {alerts.length} active
              </span>
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {alerts.map((alert) => {
                // Find user status from displayUsers
                const user = displayUsers.find(u => u.tourist_id === alert.tourist_id);
                const userStatus = user?.status || alert.status || 'safe';
                const statusColors = {
                  safe: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
                  alert: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
                  danger: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
                };
                const sc = statusColors[userStatus as keyof typeof statusColors] || statusColors.safe;

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border ${alert.alert_type === 'entered_danger_zone'
                      ? 'bg-destructive/10 border-destructive/30'
                      : alert.status === 'danger'
                        ? 'bg-destructive/10 border-destructive/30'
                        : 'bg-warning/10 border-warning/30'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${alert.status === 'danger' ? 'text-destructive' : 'text-warning'}`} />
                          <span className="font-medium">{alert.username}</span>
                          {alert.zone_name && (
                            <>
                              <span className="text-xs text-muted-foreground">entered</span>
                              <span className="font-medium text-destructive">{alert.zone_name}</span>
                            </>
                          )}
                          {/* User Status Badge */}
                          <span className={`text-xs px-2 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                            {userStatus.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{alert.tourist_id}</p>
                        {alert.lat && alert.lng && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {alert.created_at && parseUTC(alert.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissAlert(alert.id)}
                          className="text-muted-foreground hover:text-foreground"
                          disabled={userStatus !== 'safe'}
                          title={userStatus !== 'safe' ? `Cannot dismiss - User is ${userStatus.toUpperCase()}` : 'Dismiss alert'}
                        >
                          Dismiss
                        </Button>
                        {userStatus !== 'safe' && (
                          <span className="text-xs text-muted-foreground">
                            User is {userStatus.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registered Users Table */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Registered Tourists
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {statsTotal} registered
              </span>
            </h2>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {displayUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No registered tourists yet</p>
              ) : (
                displayUsers.map((user) => {
                  const statusColors = {
                    safe: { border: 'border-green-500/40', avatar: 'bg-green-500/20 border-green-500', text: 'text-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/50', emoji: '✅' },
                    alert: { border: 'border-amber-500/40', avatar: 'bg-amber-500/20 border-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/50', emoji: '⚠️' },
                    danger: { border: 'border-red-500/50', avatar: 'bg-red-500/20 border-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/50', emoji: '🚨' },
                  };
                  const sc = statusColors[user.status as keyof typeof statusColors] || statusColors.safe;
                  
                  // Find user's current location
                  const userLocation = userLocations.find(loc => loc.tourist_id === user.tourist_id);

                  // Get address from location (reverse geocoding cached in location object)
                  const displayAddress = userLocation?.address || `${userLocation?.lat.toFixed(4)}, ${userLocation?.lng.toFixed(4)}`;

                  // Check if user is in any danger zone
                  const isInDangerZone = dangerZones.some(zone => {
                    if (!userLocation) return false;
                    const distance = Math.sqrt(
                      Math.pow(userLocation.lat - zone.lat, 2) +
                      Math.pow(userLocation.lng - zone.lng, 2)
                    ) * 111000; // Convert to meters
                    return distance <= zone.radius;
                  });

                  return (
                    <div
                      key={user.user_id}
                      className={`p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border ${
                        isInDangerZone ? 'border-destructive/80 bg-destructive/10' : sc.border
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full ${sc.avatar} border-2 flex items-center justify-center flex-shrink-0 font-bold text-sm ${sc.text}`}>
                            {user.username?.slice(0, 2).toUpperCase() || 'TU'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{user.username}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{user.tourist_id}</p>
                            {user.email && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">📧 {user.email}</p>
                            )}
                            {userLocation && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate" title={displayAddress}>
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{displayAddress}</span>
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Registered: {user.created_at && parseUTC(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            isInDangerZone
                              ? 'bg-destructive/30 text-destructive border-destructive/50 animate-pulse'
                              : sc.badge
                          }`}>
                            {isInDangerZone ? '🚨 EMERGENCY' : `${sc.emoji} ${user.status?.toUpperCase() || 'SAFE'}`}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7"
                              onClick={() => setNotifyTarget(user)}
                            >
                              <Send className="w-3 h-3" />
                              Notify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7 text-destructive border-destructive/50 hover:text-destructive"
                              onClick={() => handleDeleteUser(user)}
                              disabled={!user.wallet_address}
                              title={user.wallet_address ? 'Delete from blockchain' : 'Wallet address not available'}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Alerts History */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Alert Activity
            </h2>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No alerts yet</p>
              ) : (
                alerts.slice(0, 10).map((alert) => {
                  // Find user status
                  const user = displayUsers.find(u => u.tourist_id === alert.tourist_id);
                  const userStatus = user?.status || alert.status || 'safe';
                  const statusColors = {
                    safe: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', emoji: '✅' },
                    alert: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50', emoji: '⚠️' },
                    danger: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', emoji: '🚨' },
                  };
                  const sc = statusColors[userStatus as keyof typeof statusColors] || statusColors.safe;

                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border ${alert.status === 'danger' ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {alert.status === 'danger' ? (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            ) : (
                              <Bell className="w-4 h-4 text-warning" />
                            )}
                            <span className="font-medium">{alert.username}</span>
                            {/* User Status Badge */}
                            <span className={`text-xs px-2 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                              {sc.emoji} {userStatus.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">{alert.tourist_id}</p>
                          {alert.alert_type === 'entered_danger_zone' && (
                            <p className="text-xs text-destructive mt-1">
                              Entered: {alert.zone_name} ({alert.zone_level})
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {alert.created_at && (() => {
                              const d = parseUTC(alert.created_at);
                              const now = new Date();
                              const isToday = d.toDateString() === now.toDateString();
                              const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              return isToday
                                ? `Today ${time}`
                                : `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${time}`;
                            })()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissAlert(alert.id)}
                          className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
                          disabled={userStatus !== 'safe'}
                          title={userStatus !== 'safe' ? `Cannot dismiss - User is ${userStatus.toUpperCase()}` : 'Dismiss alert'}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Danger Zones */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Danger Zones (Blockchain)
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                    {dangerZones.length}
                  </span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => navigate('/blockchain-danger-zones')}
                  variant="outline"
                  className="gap-2 text-xs h-8"
                  title="Manage danger zones on blockchain only"
                >
                  <Shield className="w-4 h-4" />
                  Blockchain Danger Zones
                </Button>
                <Button
                  onClick={() => setShowAddZone(!showAddZone)}
                  className="btn-gradient"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Zone
                </Button>
              </div>
            </div>

            {/* Add Zone Form */}
            {showAddZone && (
              <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border">
                <h3 className="font-medium mb-4">Add New Danger Zone</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Input
                    placeholder="Zone Name"
                    value={newZone.name}
                    onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                    className="bg-muted/50"
                  />
                  <Input
                    placeholder="Latitude"
                    type="number"
                    step="0.000001"
                    value={newZone.lat}
                    onChange={(e) => setNewZone({ ...newZone, lat: e.target.value })}
                    className="bg-muted/50"
                  />
                  <Input
                    placeholder="Longitude"
                    type="number"
                    step="0.000001"
                    value={newZone.lng}
                    onChange={(e) => setNewZone({ ...newZone, lng: e.target.value })}
                    className="bg-muted/50"
                  />
                  <Input
                    placeholder="Radius (m)"
                    type="number"
                    value={newZone.radius}
                    onChange={(e) => setNewZone({ ...newZone, radius: e.target.value })}
                    className="bg-muted/50"
                  />
                  <select
                    value={newZone.level}
                    onChange={(e) => setNewZone({ ...newZone, level: e.target.value as 'Low' | 'Medium' | 'High' | 'Critical' })}
                    className="px-3 py-2 rounded-lg bg-muted/50 border border-border"
                  >
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                    <option value="Critical">Critical Risk</option>
                  </select>
                </div>
                <Button
                  onClick={addDangerZone}
                  className="btn-gradient mt-4"
                >
                  Save Zone
                </Button>
              </div>
            )}

            {/* Zones List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dangerZones.length === 0 ? (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  No danger zones added yet
                </p>
              ) : (
                dangerZones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-4 rounded-xl border ${getLevelColor(zone.level)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{zone.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Radius: {zone.radius}m
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditZone(zone)}
                          className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
                          title="Edit zone"
                        >
                          <Edit2 className="w-4 h-4 text-primary" />
                        </button>
                        <button
                          onClick={() => removeDangerZone(zone.id)}
                          className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                          title="Delete zone"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className={`text-xs font-medium uppercase px-2 py-1 rounded ${getLevelColor(zone.level)}`}>
                        {zone.level} Risk
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Danger Zone Modal */}
      {showEditZone && editingZone && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Edit Danger Zone</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditZone(false);
                  setEditingZone(null);
                }}
                className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Zone Name</label>
                <Input
                  value={editZoneData.name}
                  onChange={(e) => setEditZoneData({ ...editZoneData, name: e.target.value })}
                  placeholder="Enter zone name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Radius (meters)</label>
                <Input
                  type="number"
                  value={editZoneData.radius}
                  onChange={(e) => setEditZoneData({ ...editZoneData, radius: e.target.value })}
                  placeholder="Enter radius"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Risk Level</label>
                <select
                  value={editZoneData.level}
                  onChange={(e) => setEditZoneData({ ...editZoneData, level: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                  <option value="Critical">Critical Risk</option>
                </select>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={updateZone}
                  className="flex-1 btn-gradient"
                >
                  Update Zone
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditZone(false);
                    setEditingZone(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {notifyTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Send Alert</h3>
              </div>
              <button
                onClick={() => setNotifyTarget(null)}
                className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm font-medium">{notifyTarget.username}</p>
              <p className="text-xs text-muted-foreground font-mono">{notifyTarget.tourist_id}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Alert Type</label>
                <select
                  value={notifyType}
                  onChange={(e) => setNotifyType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm"
                >
                  <option value="info">ℹ️ Information</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="danger">🚨 Danger Alert</option>
                  <option value="evacuation">🏃 Evacuation Order</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="Type your alert message..."
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm h-24 resize-none"
                />
              </div>

              <Button
                onClick={sendNotification}
                disabled={!notifyMessage.trim() || isSendingNotification}
                className="w-full btn-gradient gap-2"
              >
                {isSendingNotification ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Notification
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
