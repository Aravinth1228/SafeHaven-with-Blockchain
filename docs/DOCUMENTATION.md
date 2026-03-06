# Tourist Safety System - Complete Documentation

## Quick Start Guide

### Prerequisites

1. **MetaMask Wallet** - Install from [metamask.io](https://metamask.io)
2. **Ethereum Testnet (Sepolia)** - Add testnet to MetaMask and get test ETH from a faucet
3. **Node.js 18+** - For local development

---

## How to Run the Application

### Frontend (React App)

The frontend runs automatically when you open the project in Lovable. To run locally:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:5173`

### Backend (Edge Functions)

The backend runs on Lovable Cloud automatically. Edge functions are deployed when you save changes.

**API Base URL:** `https://iqsibcjzkwhfxhlcxuef.supabase.co/functions/v1/api`

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/users` | GET | Get all users (admin only) |
| `/users/:id` | GET | Get user by ID |
| `/users/:id/status` | PATCH | Update user status |
| `/danger-zones` | GET | Get all danger zones |
| `/danger-zones` | POST | Create danger zone (admin only) |
| `/danger-zones/:id` | DELETE | Delete danger zone (admin only) |
| `/alerts` | GET | Get active alerts |
| `/alerts/:id/dismiss` | PATCH | Dismiss alert |
| `/locations` | POST | Update user location |
| `/analytics` | GET | Get dashboard analytics |

### Database

The database is managed by Lovable Cloud (PostgreSQL). No setup required!

**Tables:**

| Table | Description |
|-------|-------------|
| `profiles` | User profile information |
| `alerts` | Emergency alerts |
| `danger_zones` | Geofenced danger areas |
| `user_locations` | Real-time user positions |
| `user_roles` | Admin/user role assignments |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                      │
├─────────────────────────────────────────────────────────────────┤
│  Pages: Login, SignUp, Dashboard, AdminDashboard                 │
│  Components: MapboxMap, Navbar, MetaMaskGuide                    │
│  Contexts: AuthContext, WalletContext                            │
│  Hooks: useContract, useAPI, useRealtimeAlerts, useRealtimeLocations │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Backend API  │   │  Blockchain   │   │  Mapbox API   │
│  (Edge Func)  │   │  (Ethereum)   │   │  (Maps)       │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                         │
│  Tables: profiles, alerts, danger_zones, user_locations       │
│  Features: RLS, Real-time subscriptions, Auto-generated IDs   │
└───────────────────────────────────────────────────────────────┘
```

---

## Connecting Frontend + Backend + Database

### 1. Environment Configuration

The `.env` file is auto-configured with these variables:

```env
VITE_SUPABASE_URL=https://iqsibcjzkwhfxhlcxuef.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your_anon_key>
VITE_SUPABASE_PROJECT_ID=iqsibcjzkwhfxhlcxuef
```

### 2. API Client Setup

The frontend uses `src/lib/api.ts` to communicate with the backend:

```typescript
import { api } from '@/lib/api';

// Fetch all users (admin)
const users = await api.users.getAll();

// Update user location
await api.locations.update({
  user_id: 'uuid',
  tourist_id: 'TID-XXX',
  lat: 12.345,
  lng: 67.890
});

// Create danger zone (admin)
await api.dangerZones.create({
  name: 'Flood Zone',
  lat: 12.345,
  lng: 67.890,
  radius: 500,
  level: 'high'
});
```

### 3. Real-time Subscriptions

Enable real-time updates in your components:

```typescript
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { useRealtimeLocations } from '@/hooks/useRealtimeLocations';

// Listen for new alerts
useRealtimeAlerts({
  onNewAlert: (alert) => {
    console.log('New alert:', alert);
  },
  enabled: true
});

// Listen for location updates
useRealtimeLocations({
  onLocationUpdate: (location) => {
    console.log('Location updated:', location);
  },
  enabled: true
});
```

### 4. Database Client

Direct database access (for authenticated users):

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query profiles
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', userId);

// Insert alert
const { data, error } = await supabase
  .from('alerts')
  .insert({
    user_id: userId,
    tourist_id: touristId,
    username: 'John',
    status: 'danger'
  });
```

---

## User Registration Flow

1. **Connect Wallet** - User connects MetaMask wallet
2. **Fill Form** - Username, email, phone, DOB, password
3. **Pay Fee** - Registration fee (0.001 ETH) sent to admin wallet via MetaMask
4. **Blockchain Storage** - Identity stored on Ethereum blockchain
5. **Database Storage** - Profile saved to PostgreSQL database
6. **Tourist ID Generated** - Unique ID (TID-XXXXXX-XXXX) created

### Important Constraints

- **One Wallet = One Account**: Each MetaMask wallet address can only register once
- **Unique Email**: Each email address can only be used once
- **Required Fields**: Username, email, phone, DOB, password are mandatory

---

## Admin Setup

### Admin Wallet Address

The current admin wallet is:

```
0x548cb269df02005590CF48fb031dD697e52aa201
```

### How to Access Admin Dashboard

1. Go to `/admin` route
2. Connect MetaMask with the admin wallet address
3. Sign the verification message
4. Access admin features (user management, danger zones, alerts)

### Adding New Admins

1. Deploy the smart contract with your wallet as owner
2. Call `addAdmin(address)` function from owner wallet
3. New admin can now access the admin dashboard

---

## Smart Contract (TouristSafety.sol)

### Contract Address (Localhost/Development)

```
0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Deployment

1. Install Hardhat: `npm install --save-dev hardhat`
2. Compile: `npx hardhat compile`
3. Deploy to testnet:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

4. Update `src/lib/contract/abi.ts` with deployed address

### Key Functions

| Function | Description | Access |
|----------|-------------|--------|
| `registerTourist()` | Register with payment | Public (payable) |
| `updateStatus()` | Update safety status | Registered tourist |
| `triggerEmergency()` | Send emergency alert | Registered tourist |
| `addDangerZone()` | Create danger zone | Admin only |
| `removeDangerZone()` | Delete danger zone | Admin only |
| `isAdmin()` | Check admin status | Public |
| `withdrawFees()` | Withdraw collected fees | Owner only |

### Events

```solidity
event TouristRegistered(address indexed tourist, string touristId, uint256 timestamp);
event StatusUpdated(address indexed tourist, uint8 status, uint256 timestamp);
event EmergencyAlert(address indexed tourist, string touristId, int256 lat, int256 lng, uint256 timestamp);
event DangerZoneAdded(uint256 indexed zoneId, string name, int256 lat, int256 lng, uint256 radius);
```

---

## Real-time Features

### Database Realtime (via Supabase)

- **Alerts**: Admins receive instant notifications when users trigger alerts
- **Locations**: Live tracking updates on admin map
- **Danger Zones**: Updates sync across all clients

Realtime is enabled for these tables:
- `alerts`
- `user_locations`
- `danger_zones`

### Blockchain Events

- Emergency alerts logged on-chain
- Status changes recorded immutably
- Danger zone modifications tracked

---

## Security

### Row Level Security (RLS)

All tables have RLS policies:

| Table | Policy |
|-------|--------|
| `profiles` | Users see own profile; Admins see all; No public access |
| `user_locations` | Users manage own location; Admins see all; No public access |
| `alerts` | Users create own alerts; Admins view/update all |
| `danger_zones` | Everyone can view; Admins can manage |
| `user_roles` | Users view own roles; Admins manage all |

### Authentication Flow

1. User connects MetaMask wallet
2. Wallet signature verifies identity
3. JWT token generated for API requests
4. Admin status verified on-chain

---

## Troubleshooting

### Common Issues

1. **MetaMask not detected**
   - Ensure MetaMask extension is installed
   - Refresh the page after installation

2. **Transaction failed**
   - Check you have enough ETH for gas + registration fee
   - Ensure you're on the correct network (Sepolia testnet)

3. **Admin login fails**
   - Verify wallet address matches admin wallet
   - Check smart contract is deployed and accessible

4. **Real-time updates not working**
   - Check browser console for websocket errors
   - Ensure user is authenticated

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
location.reload();
```

---

## API Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Project Structure

```
├── src/
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts (Auth, Wallet)
│   ├── hooks/            # Custom hooks (useContract, useAPI, etc.)
│   ├── integrations/     # Supabase client & types
│   ├── lib/
│   │   ├── api.ts        # API client
│   │   └── contract/     # Smart contract integration
│   ├── pages/            # Route pages
│   └── main.tsx          # App entry point
├── supabase/
│   ├── functions/        # Edge functions
│   └── config.toml       # Supabase config
├── contracts/            # Solidity smart contracts
└── docs/                 # Documentation
```

---

*Last Updated: January 2026 | Version: 3.0.0*
