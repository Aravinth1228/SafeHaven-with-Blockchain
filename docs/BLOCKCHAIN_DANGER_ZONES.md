# Blockchain Danger Zone Guide

## Overview

This guide explains how to use the **Blockchain-Only Danger Zone** feature in SafeHeaven. Danger zones created using this feature are stored **exclusively on the blockchain**, ensuring:

- ✅ **Immutability** - Cannot be tampered with once created
- ✅ **Transparency** - All transactions are publicly verifiable
- ✅ **Decentralization** - No reliance on centralized database
- ✅ **Audit Trail** - Complete history on blockchain

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Admin Dashboard│─────▶│  Backend Relayer │─────▶│  Smart Contract │
│  (React UI)     │      │  (Node.js)       │      │  (Ethereum)     │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                │
                                ▼
                         ┌──────────────────┐
                         │  MongoDB (Optional)│
                         │  - Notifications   │
                         │  - User Alerts     │
                         └──────────────────┘
```

**Key Points:**
- Danger zone data is stored **ONLY on blockchain**
- MongoDB is used only for notifications and alerts (temporary data)
- Admin wallet pays gas fees for all transactions

## Smart Contract Functions

### Create Danger Zone

```solidity
function createDangerZone(
    string calldata _name,
    int256 _latitude,
    int256 _longitude,
    uint256 _radius,
    ZoneLevel _level
) external onlyAdmin returns (string memory)
```

**Parameters:**
- `_name` - Zone name/description
- `_latitude` - Latitude * 1e6 (for precision)
- `_longitude` - Longitude * 1e6
- `_radius` - Radius in meters
- `_level` - Danger level (0=Low, 1=Medium, 2=High, 3=Critical)

### Remove Danger Zone

```solidity
function removeDangerZone(uint256 _zoneIndex) external onlyAdmin
```

**Parameters:**
- `_zoneIndex` - Index of the zone in the array

### View Functions

```solidity
function getAllDangerZones() external view returns (DangerZone[] memory)
function getActiveDangerZones() external view returns (DangerZone[] memory)
function dangerZones(uint256) external view returns (DangerZone)
```

## API Endpoints

### Get All Danger Zones

```
GET /api/blockchain/danger-zones
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ZONE-1",
      "blockchainIndex": 0,
      "zoneId": "ZONE-1",
      "name": "Flood Prone Area",
      "lat": 13.082686,
      "lng": 80.270718,
      "radius": 500,
      "level": "Medium",
      "createdBy": "0x...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "isActive": true
    }
  ],
  "blockchainEnabled": true
}
```

### Create Danger Zone

```
POST /api/blockchain/danger-zones
```

**Request Body:**
```json
{
  "name": "Flood Prone Area",
  "lat": 13.082686,
  "lng": 80.270718,
  "radius": 500,
  "level": "Medium",
  "created_by": "0xAdminWalletAddress",
  "signature": "0xSignature",
  "message": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "blockchain": {
    "txHash": "0x...",
    "blockNumber": 12345,
    "zoneId": "ZONE-1"
  },
  "message": "Danger zone created on blockchain only"
}
```

### Remove Danger Zone

```
DELETE /api/blockchain/danger-zones/:index
```

**Request Body:**
```json
{
  "admin_wallet": "0xAdminWalletAddress"
}
```

## Usage Guide

### 1. Access Blockchain Danger Zones

1. Log in to Admin Dashboard at `/admin-dashboard`
2. Click **"Blockchain Danger Zones"** button
3. Or navigate directly to `/blockchain-danger-zones`

### 2. Create a Danger Zone

1. Click **"Add Zone"** button
2. Fill in the form:
   - **Zone Name**: Descriptive name (e.g., "Flood Zone A")
   - **Latitude**: GPS coordinate (e.g., 13.082686)
   - **Longitude**: GPS coordinate (e.g., 80.270718)
   - **Radius**: Coverage in meters (e.g., 500)
   - **Danger Level**: Low, Medium, High, or Critical
3. Click **"Create Zone"**
4. MetaMask will prompt for signature
5. Wait for blockchain confirmation (~15-30 seconds on Sepolia)
6. Zone appears in the list once confirmed

### 3. Remove a Danger Zone

1. Find the zone in the list
2. Click **"Remove from Blockchain"**
3. Confirm the action in the dialog
4. MetaMask will prompt for signature
5. Wait for blockchain confirmation
6. Zone is marked as inactive on blockchain

## Frontend Integration

### Using the Hook

```typescript
import { useBlockchainDangerZones } from '@/hooks/useBlockchainDangerZones';

function MyComponent() {
  const {
    zones,
    isLoading,
    blockchainStatus,
    checkBlockchainStatus,
    fetchDangerZones,
    createDangerZone,
    removeDangerZone,
  } = useBlockchainDangerZones();

  // Create a zone
  const handleCreate = async () => {
    await createDangerZone({
      name: 'Danger Zone',
      lat: 13.082686,
      lng: 80.270718,
      radius: 500,
      level: 'High'
    });
  };

  // Remove a zone
  const handleRemove = async (index: number) => {
    await removeDangerZone(index);
  };

  return (
    // Render zones
  );
}
```

### Check Blockchain Status

```typescript
const status = await checkBlockchainStatus();
console.log('Network:', status.network);
console.log('Contract:', status.contractAddress);
```

## Backend Configuration

### Environment Variables

Add to `.env` in server folder:

```env
# Admin wallet (relayer)
ADMIN_PRIVATE_KEY=your_private_key_here

# RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_ID
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_ID
```

### Deploy Contracts

```bash
cd contracts
npm install
npm run compile
npm run deploy:sepolia
```

### Start Server

```bash
cd server
npm install
npm run dev
```

## Gas Costs

**Estimated Gas Costs (Sepolia Testnet):**

| Operation | Gas Used | Cost (Sepolia ETH) |
|-----------|----------|-------------------|
| Create Zone | ~150,000 | ~0.0003 ETH |
| Remove Zone | ~50,000 | ~0.0001 ETH |

**Note:** Admin wallet (relayer) pays all gas fees. Users don't need to pay anything.

## Comparison: MongoDB vs Blockchain

| Feature | MongoDB | Blockchain |
|---------|---------|------------|
| Storage | Database | Smart Contract |
| Immutability | ❌ Can be modified | ✅ Immutable |
| Transparency | ❌ Private | ✅ Public |
| Decentralization | ❌ Centralized | ✅ Decentralized |
| Gas Cost | None | Required |
| Speed | Fast | Slower (block time) |
| Audit Trail | Limited | Complete |

## Troubleshooting

### "Blockchain not initialized"

**Cause:** Contracts not deployed or deployment info missing

**Solution:**
1. Run `npm run deploy:sepolia` in contracts folder
2. Ensure `blockchain-deployment.json` exists in server folder
3. Restart the server

### "Invalid nonce"

**Cause:** Nonce mismatch between local and on-chain

**Solution:**
1. Delete `server/blockchain/nonces.json`
2. Restart the server
3. Try again

### "Transaction failed"

**Cause:** Insufficient gas, reverted transaction, or network issues

**Solution:**
1. Check admin wallet has enough ETH for gas
2. Verify contract is deployed correctly
3. Check blockchain explorer for transaction details
4. Increase gas limit if needed

### "Signature expired"

**Cause:** Meta-transaction signature took too long

**Solution:**
1. Signatures expire after 1 hour
2. Simply try again with a new signature
3. Ensure quick confirmation in MetaMask

## Security Considerations

1. **Private Key Security**
   - Never commit `.env` files to git
   - Use environment variables for sensitive data
   - Consider using a secrets manager in production

2. **Admin Access Control**
   - Only admin wallets can create/remove zones
   - Contract verifies admin status on-chain
   - Keep admin private keys secure

3. **Input Validation**
   - All inputs are validated on backend
   - Coordinates are sanitized
   - Radius and level are checked

## Future Enhancements

- [ ] Batch zone creation (multiple zones in one transaction)
- [ ] Zone updates (modify existing zones)
- [ ] Zone expiration (auto-deactivate after time)
- [ ] Zone categories (flood, fire, crime, etc.)
- [ ] Zone statistics (entries, alerts triggered)
- [ ] Multi-admin support (DAO governance)

## Support

For issues or questions:
- Check the contract logs: `contracts/cache/`
- Check server logs: Console output
- View transactions on: [Sepolia Etherscan](https://sepolia.etherscan.io)

---

**Last Updated:** March 2026
**Version:** 1.0.0
