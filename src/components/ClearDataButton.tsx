import React from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/**
 * ClearDataButton Component
 * 
 * A button to clear all user data from localStorage
 * Useful for testing and debugging
 */
export function ClearDataButton() {
  const { toast } = useToast();

  const handleClearData = () => {
    if (!confirm('Are you sure you want to clear all user data?\n\nThis will:\n- Delete all local user accounts\n- Clear current session\n- Remove location data\n\n⚠️ Blockchain data will NOT be deleted!')) {
      return;
    }

    console.log('🧹 Clearing all user data...\n');
    
    // List of all localStorage keys to clear
    const keysToClear = [
      'users',
      'currentUser',
      'adminWalletAddress',
      'isAdmin',
      'walletAddress',
    ];
    
    let clearedCount = 0;
    
    // Clear each key
    keysToClear.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        console.log(`🗑️  Removing: ${key}`);
        localStorage.removeItem(key);
        clearedCount++;
      }
    });
    
    // Clear all user location data
    const allKeys = Object.keys(localStorage);
    const locationKeys = allKeys.filter(key => key.startsWith('userLocation-'));
    locationKeys.forEach(key => {
      console.log(`🗑️  Removing: ${key}`);
      localStorage.removeItem(key);
      clearedCount++;
    });
    
    // Clear all notification data
    const notificationKeys = allKeys.filter(key => key.startsWith('notification-'));
    notificationKeys.forEach(key => {
      console.log(`🗑️  Removing: ${key}`);
      localStorage.removeItem(key);
      clearedCount++;
    });
    
    console.log(`\n✅ Cleared ${clearedCount} items from localStorage!`);
    
    toast({
      title: 'Data Cleared',
      description: `Cleared ${clearedCount} items from local storage. Refreshing...`,
    });
    
    // Refresh page after 1 second
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <Button
      onClick={handleClearData}
      variant="outline"
      size="sm"
      className="gap-2 text-destructive hover:text-destructive border-destructive/50"
      title="Clear all user data from localStorage"
    >
      <Trash2 className="w-4 h-4" />
      Clear Data
    </Button>
  );
}

/**
 * RefreshButton Component
 * 
 * Simple refresh button for testing
 */
export function RefreshButton() {
  const { toast } = useToast();

  const handleRefresh = () => {
    toast({
      title: 'Refreshing...',
      description: 'Reloading page data.',
    });
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <Button
      onClick={handleRefresh}
      variant="outline"
      size="sm"
      className="gap-2"
      title="Refresh page"
    >
      <RefreshCw className="w-4 h-4" />
      Refresh
    </Button>
  );
}
