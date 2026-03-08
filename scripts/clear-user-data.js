/**
 * Clear All User Data Script
 * 
 * Run this in browser console to clear all user data
 * This will remove:
 * - All users from localStorage
 * - Current user session
 * - Admin wallet data
 * - User locations
 * - Wallet connections
 * 
 * ⚠️ WARNING: This will NOT delete data from blockchain
 * Blockchain data is permanent and cannot be deleted
 */

function clearAllUserData() {
  console.log('🧹 Starting to clear all user data...\n');
  
  // List of all localStorage keys to clear
  const keysToClear = [
    'users',
    'currentUser',
    'adminWalletAddress',
    'isAdmin',
    'walletAddress',
  ];
  
  // Clear each key
  keysToClear.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`🗑️  Removing: ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Clear all user location data
  const allKeys = Object.keys(localStorage);
  const locationKeys = allKeys.filter(key => key.startsWith('userLocation-'));
  locationKeys.forEach(key => {
    console.log(`🗑️  Removing: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Clear all notification data
  const notificationKeys = allKeys.filter(key => key.startsWith('notification-'));
  notificationKeys.forEach(key => {
    console.log(`🗑️  Removing: ${key}`);
    localStorage.removeItem(key);
  });
  
  console.log('\n✅ All user data cleared from localStorage!');
  console.log('\n⚠️  Note: Blockchain data is NOT deleted');
  console.log('   To reset blockchain data, you need to:');
  console.log('   1. Deploy a new contract, OR');
  console.log('   2. Use a different wallet address');
  console.log('\n🔄 Refresh the page to see changes...');
  
  // Optional: Auto-refresh after 2 seconds
  setTimeout(() => {
    console.log('🔄 Refreshing page...');
    window.location.reload();
  }, 2000);
}

// Run the function
clearAllUserData();
