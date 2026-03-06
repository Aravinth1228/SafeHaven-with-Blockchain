# RainbowKit + ethers.js Integration Guide

## Overview

This project now uses **RainbowKit** for wallet connections while maintaining **ethers.js** for EIP712 signing and backend relayer operations.

## Architecture

```
┌─────────────────┐
│   RainbowKit    │ ← Beautiful wallet connection UI
│     (wagmi)     │ ← Wallet state management
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  WagmiSigner    │ ← Custom ethers.js signer
│  (bridge layer) │   wrapping wagmi connector
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   ethers.js     │ ← EIP712 signing
│  blockchainSvc  │ ← Meta-transaction logic
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Backend        │ ← Signature verification
│   Relayer       │ ← Gas payment & tx submission
└─────────────────┘
```

## Flow

1. **Wallet Connection**: RainbowKit handles wallet selection and connection
2. **Signer Sync**: `useRainbowKitSync` hook creates an ethers.js signer from wagmi connector
3. **EIP712 Signing**: `blockchainService` uses the synced signer for typed data signing
4. **Relayer**: Backend verifies signature and submits transaction (user doesn't pay gas)

## Files Created/Modified

### New Files

- `src/lib/wagmiConfig.ts` - Wagmi configuration with connectors
- `src/components/blockchain/RainbowKitWrapper.tsx` - RainbowKit provider component
- `src/contexts/useRainbowKitSync.tsx` - Hook that syncs wagmi with ethers.js

### Modified Files

- `src/App.tsx` - Wrapped with RainbowKitProvider
- `src/contexts/WalletContext.tsx` - Syncs with wagmi state
- `src/lib/blockchainService.ts` - Added `setSignerFromWagmi()` method
- `src/components/blockchain/WalletConnect.tsx` - Uses RainbowKit ConnectButton
- `.env` - Added `VITE_WALLETCONNECT_PROJECT_ID`

## Usage

### Basic Wallet Connection

```tsx
import { WalletConnect } from '@/components/blockchain/WalletConnect';

function MyComponent() {
  return <WalletConnect />;
}
```

### Using Blockchain Features

```tsx
import { useBlockchain } from '@/hooks/useBlockchain';

function EmergencyButton() {
  const { isConnected, signAndUpdateStatus } = useBlockchain();

  const handleEmergency = async () => {
    if (!isConnected) {
      alert('Please connect wallet first');
      return;
    }
    
    // User signs EIP712 message (no gas fee)
    await signAndUpdateStatus(2); // 2 = Danger/Emergency
    // Backend relayer submits transaction
  };

  return (
    <button onClick={handleEmergency}>
      🚨 EMERGENCY
    </button>
  );
}
```

### Registration Flow

```tsx
import { BlockchainRegistration } from '@/components/blockchain/WalletConnect';

function SignUpPage() {
  return (
    <BlockchainRegistration 
      onComplete={() => {
        console.log('Registered on blockchain!');
      }} 
    />
  );
}
```

## Configuration

### Environment Variables

```env
# WalletConnect Project ID (get from https://cloud.walletconnect.com)
VITE_WALLETCONNECT_PROJECT_ID=your-project-id-here

# Contract addresses (from deployment)
VITE_CONTRACT_ADDRESS=0x...
VITE_FORWARDER_ADDRESS=0x...

# Network
VITE_CHAIN_ID=11155111  # Sepolia
```

### Supported Wallets

- **MetaMask** - Direct connection
- **WalletConnect** - Mobile wallets via QR code
- **Injected Wallets** - Coinbase Wallet, Brave, etc.

## Key Components

### WagmiSigner (`src/contexts/useRainbowKitSync.tsx`)

Custom ethers.js signer that wraps wagmi's connector, enabling:
- `signMessage()` - Personal message signing
- `signTypedData()` - EIP712 structured data signing

### useRainbowKitSync Hook

Automatically syncs wagmi connector with `blockchainService`:
```tsx
// When wallet connects via RainbowKit:
// 1. Hook detects connection
// 2. Creates WagmiSigner from connector
// 3. Updates blockchainService with signer
// 4. EIP712 signing now works through RainbowKit wallet
```

## Testing

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Connect wallet:**
   - Click "Connect Wallet" button
   - Select MetaMask or scan QR code for mobile wallet

3. **Test EIP712 signing:**
   - Navigate to registration page
   - Fill form and click "Sign & Register"
   - Wallet will prompt for signature
   - Backend relayer submits transaction

## Troubleshooting

### "Wallet not connected" error

Ensure RainbowKit is properly initialized:
```tsx
// Check in browser console:
window.ethereum  // Should be defined
```

### EIP712 signing fails

Verify the signer sync:
```tsx
// Check console logs for:
// ✅ blockchainService.setSignerFromWagmi called: 0x...
```

### Build warnings

The warnings about `/*#__PURE__*/` comments are from dependencies and can be ignored.

## Resources

- [RainbowKit Docs](https://www.rainbowkit.com/)
- [wagmi Docs](https://wagmi.sh/)
- [ethers.js Docs](https://docs.ethers.org/)
- [WalletConnect Cloud](https://cloud.walletconnect.com/)
