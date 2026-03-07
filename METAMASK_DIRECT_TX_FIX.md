# MetaMask Direct Transaction Integration

## Overview
This document explains the changes made to enable **direct MetaMask transactions** for user registration and status updates on the blockchain.

## Problem
Previously, the application used **meta-transactions** (ERC-2771) where:
- Users sign messages WITHOUT gas (gasless)
- Backend relayer submits transactions
- Complex setup with trusted forwarder

**Issues:**
- MetaMask popup didn't appear for registration
- Users couldn't see their transactions on blockchain explorers
- Dependency on backend relayer

## Solution
Now the application uses **direct transactions**:
- ✅ MetaMask popup appears when registering
- ✅ Users pay gas directly (or use Sepolia testnet)
- ✅ `registerTourist()` function called directly on blockchain
- ✅ `updateStatus()` function called directly on blockchain
- ✅ Admin dashboard shows blockchain data in real-time

## Changes Made

### 1. AuthContext (`src/contexts/AuthContext.tsx`)
**Before:**
```typescript
// Used meta-transactions via backend relayer
const result = await signAndRegister({ username, email, phone, dateOfBirth });
```

**After:**
```typescript
// Direct contract call - MetaMask popup appears!
const success = await contractRegisterTourist(
  username,
  email,
  phone,
  new Date(dob)
);
```

**Status Update:**
```typescript
// Now updates on blockchain with MetaMask popup
const success = await contractUpdateStatus('Alert'); // or 'Safe', 'Emergency'
```

### 2. useContract Hook (`src/hooks/useContract.ts`)
Added new exported functions:
- `isTouristRegistered(address)` - Check if wallet is registered
- `getAllTouristAddresses()` - Get all registered tourist addresses from events

### 3. Contract Service (`src/lib/contract/contractService.ts`)
Enhanced error handling and added fallback methods:
```typescript
async getAllTourists(): Promise<Tourist[]> {
  // Try direct call (admin only)
  // Fallback to event-based fetching if fails
}

async getAllTouristAddresses(): Promise<string[]> {
  // Fetch from TouristRegistered events
  // Works without admin privileges
}
```

### 4. AdminDashboard (`src/pages/AdminDashboard.tsx`)
Now fetches user data from **blockchain** instead of just MongoDB:
```typescript
// Load from blockchain first
const blockchainTourists = await getAllTourists();

// Fallback to event-based fetching
const addresses = await getAllTouristAddresses();

// Merge with API data
const mergedUsers = [...apiProfiles, ...blockchainProfiles];
```

## User Flow

### Registration Flow
1. User clicks "Sign Up"
2. Connects MetaMask wallet
3. Fills registration form (username, email, phone, DOB)
4. Clicks "Create Account"
5. **MetaMask popup appears** ⭐
6. User confirms transaction (pays gas)
7. Transaction submitted to blockchain
8. `registerTourist()` called on contract
9. User stored on blockchain + local database
10. Redirected to dashboard

### Status Update Flow
1. User on dashboard clicks SAFE/ALERT/DANGER button
2. **MetaMask popup appears** ⭐
3. User confirms transaction
4. `updateStatus()` called on blockchain
5. Status updated on blockchain + MongoDB
6. Admin dashboard shows real-time update

### Admin Dashboard
1. Admin connects MetaMask wallet
2. Visits `/admin-dashboard`
3. Contract initializes with admin signer
4. Fetches all tourists from blockchain:
   - Direct call to `getAllTourists()` (admin only)
   - Fallback to event-based fetching
5. Displays user list with blockchain status
6. Real-time updates via polling

## Contract Functions Used

### `registerTourist(string username, string email, string phone, uint256 dateOfBirth)`
- **Called by:** Regular users during registration
- **Gas:** ~150,000 gas
- **Returns:** `string touristId`
- **Event:** `TouristRegistered(address wallet, string touristId, string username, uint256 timestamp)`

### `updateStatus(uint8 status)`
- **Called by:** Registered tourists
- **Gas:** ~50,000 gas
- **Status values:** 0=Safe, 1=Alert, 2=Emergency
- **Event:** `StatusUpdated(address tourist, string touristId, uint8 oldStatus, uint8 newStatus, uint256 timestamp)`

### `getAllTourists()`
- **Called by:** Admin only
- **Gas:** Free (view function)
- **Returns:** Array of all registered tourists

## Testing

### Prerequisites
1. MetaMask installed
2. Sepolia testnet configured (or local Hardhat node)
3. Some test ETH in wallet (use Sepolia faucet)

### Test Registration
1. Go to `/signup`
2. Connect MetaMask
3. Fill form with test data
4. Click "Create Account"
5. **Verify MetaMask popup appears**
6. Confirm transaction
7. Check transaction on Sepolia Etherscan
8. Verify redirect to dashboard

### Test Status Update
1. On dashboard, click ALERT button
2. **Verify MetaMask popup appears**
3. Confirm transaction
4. Check status updated on admin dashboard

### Test Admin Dashboard
1. Connect admin wallet
2. Go to `/admin-login`
3. Login with wallet
4. Check if blockchain users appear
5. Verify status updates in real-time

## Troubleshooting

### MetaMask popup doesn't appear
- Check if wallet is connected
- Check browser console for errors
- Ensure contract is initialized
- Verify `window.ethereum` is available

### Transaction fails
- Check if you have enough test ETH for gas
- Verify contract address in `.env`
- Check if user is already registered
- Look at contract events for error messages

### Admin dashboard shows no users
- Ensure admin wallet is connected
- Check contract address matches deployed contract
- Verify `getAllTourists()` doesn't revert
- Check browser console for errors

## Benefits

✅ **Transparent:** All transactions visible on blockchain explorer
✅ **Direct:** No dependency on backend relayer
✅ **Secure:** Users control their own transactions
✅ **Real-time:** Admin dashboard updates from blockchain
✅ **Verifiable:** Tourist registration permanently stored

## Network Configuration

Update `.env` for different networks:

```env
# Sepolia Testnet
VITE_CONTRACT_ADDRESS=0xE1c5911CC4A67758d87739CDFefC0f1b43F04917
VITE_CHAIN_ID=11155111

# Local Hardhat
VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_CHAIN_ID=31337
```

## Next Steps

1. ✅ Test registration flow with MetaMask
2. ✅ Test status update flow
3. ✅ Verify admin dashboard shows blockchain data
4. 🔄 Deploy to production network (optional)
5. 🔄 Add transaction status notifications
6. 🔄 Add gas estimation before transactions

## Support

For issues or questions:
- Check browser console for error messages
- Verify contract is deployed and address is correct
- Ensure MetaMask is connected to correct network
- Check contract events on blockchain explorer
