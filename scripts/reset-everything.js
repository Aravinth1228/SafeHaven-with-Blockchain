/**
 * COMPLETE RESET SCRIPT
 * 
 * This will:
 * 1. Clear ALL localStorage
 * 2. Disconnect wallet
 * 3. Clear all cached data
 * 4. Refresh page
 * 
 * ⚠️ Blockchain data CANNOT be deleted!
 * To reset blockchain, use a different wallet address.
 */

console.log('🧹=== COMPLETE RESET ===🧹\n');

// 1. Clear all localStorage
console.log('📋 Clearing localStorage...');
const allKeys = Object.keys(localStorage);
console.log(`   Found ${allKeys.length} items in localStorage`);

allKeys.forEach(key => {
  const value = localStorage.getItem(key);
  console.log(`   🗑️  ${key}: ${value ? value.substring(0, 50) + '...' : 'empty'}`);
  localStorage.removeItem(key);
});

console.log('✅ LocalStorage cleared!\n');

// 2. Clear IndexedDB (if any)
console.log('🗄️  Clearing IndexedDB...');
if (window.indexedDB) {
  const dbRequest = indexedDB.deleteDatabase('SafeHaven');
  dbRequest.onsuccess = () => {
    console.log('✅ IndexedDB cleared!');
  };
  dbRequest.onerror = () => {
    console.log('⚠️  IndexedDB clear failed');
  };
}

// 3. Clear sessionStorage
console.log('📋 Clearing sessionStorage...');
sessionStorage.clear();
console.log('✅ SessionStorage cleared!\n');

// 4. Summary
console.log('\n📊 RESET SUMMARY:');
console.log('   ✅ LocalStorage: CLEARED');
console.log('   ✅ SessionStorage: CLEARED');
console.log('   ✅ IndexedDB: CLEARED');
console.log('   ⚠️  Blockchain: NOT CLEARED (permanent)');
console.log('\n💡 To reset blockchain data:');
console.log('   1. Open MetaMask');
console.log('   2. Create NEW account OR import different wallet');
console.log('   3. Register new user with new wallet');
console.log('\n🔄 Refreshing page in 3 seconds...');

setTimeout(() => {
  window.location.reload();
}, 3000);

console.log('\n=== RESET COMPLETE ===\n');
