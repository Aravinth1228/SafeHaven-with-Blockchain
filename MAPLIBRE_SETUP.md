# SafeHaven - MapLibre GL JS Integration Guide

## Overview

SafeHaven now uses **MapLibre GL JS** (open-source, free) instead of Google Maps for real-time GPS tracking with the following stack:

- **Frontend**: MapLibre GL JS + OpenStreetMap (CartoDB Dark Matter tiles)
- **Backend**: Node.js + Express + Socket.IO
- **Database**: MongoDB (local or Atlas)
- **Real-time**: Socket.IO for live location updates
- **Blockchain**: ERC-2771 for danger zones storage

## Features

✅ **User GPS Tracking** - Geolocation API with live updates  
✅ **Real-time Socket.IO** - Instant location streaming to admin dashboard  
✅ **MongoDB Storage** - Persistent location history  
✅ **MapLibre GL JS** - Free, open-source alternative to Google Maps  
✅ **OpenStreetMap** - Community-driven map data  
✅ **Dark Theme** - CartoDB Dark Matter tiles for modern UI  
✅ **Danger Zones** - Blockchain-stored safety zones  
✅ **Multi-user Tracking** - See all users on admin dashboard  

## Installation

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local or MongoDB Atlas)
- MetaMask or compatible wallet

### 1. Install Dependencies

```bash
# Install all dependencies (frontend + server)
npm run install:all
```

### 2. Configure Environment Variables

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_CONTRACT_ADDRESS=0x0950C3A0D3B44829F662a4A5bB40B22f0C8c0e4E
VITE_FORWARDER_ADDRESS=0xE66d67F96a4E83cD686307Ae96c846B2cB6Bb69E
VITE_CHAIN_ID=11155111
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

#### Backend (server/.env)
```env
MONGODB_URI=mongodb://localhost:27017/safehaven_sas
PORT=3000
ADMIN_PRIVATE_KEY=your_admin_private_key
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=0x0950C3A0D3B44829F662a4A5bB40B22f0C8c0e4E
FORWARDER_ADDRESS=0xE66d67F96a4E83cD686307Ae96c846B2cB6Bb69E
CHAIN_ID=11155111
```

### 3. Start MongoDB

```bash
# Local MongoDB (if installed)
mongod

# Or use MongoDB Atlas cloud database
# Update MONGODB_URI in server/.env
```

### 4. Start the Application

```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start frontend (Vite dev server)
npm run dev
```

## Architecture

### Data Flow

```
User Browser (GPS)
    ↓
Geolocation API (watchPosition)
    ↓
Frontend (MapLibre GL JS)
    ↓
HTTP POST /api/locations
    ↓
Node.js Backend
    ├─→ MongoDB (persist location)
    ├─→ Socket.IO (real-time emit)
    └─→ Danger Zone Detection
         ↓
    Socket.IO Rooms
         ↓
Admin Dashboard (Real-time Map)
```

### Socket.IO Rooms

- **admin-room**: All admins receive location updates from all users
- **user-{touristId}**: Each user receives their own location updates

### MongoDB Collections

1. **profiles** - User accounts with tourist_id
2. **alerts** - Emergency alerts and danger zone entries
3. **user_locations** - Current location of all users
4. **danger_zones** - Local cache of blockchain danger zones
5. **notifications** - Admin notifications to users

## API Endpoints

### Location Tracking

```bash
# Update user location (called every 5 seconds or on movement)
POST /api/locations
Body: {
  user_id: string,
  tourist_id: string,
  lat: number,
  lng: number,
  username: string,
  status: 'safe' | 'alert' | 'danger'
}

# Get all user locations
GET /api/locations
```

### Danger Zones (Blockchain)

```bash
# Get all danger zones from blockchain
GET /api/blockchain/danger-zones

# Create danger zone on blockchain
POST /api/blockchain/danger-zones
Body: {
  name: string,
  lat: number,
  lng: number,
  radius: number,
  level: 'Low' | 'Medium' | 'High' | 'Critical',
  created_by: string
}

# Remove danger zone from blockchain
DELETE /api/blockchain/danger-zones/:index
```

### User Management

```bash
# Get all users
GET /api/users

# Update user status
PATCH /api/users/:userId/status
Body: { status: 'safe' | 'alert' | 'danger' }

# Register new user
POST /api/register
```

## MapLibre GL JS Features

### Map Style

Using **CartoDB Dark Matter** for a modern, professional look:

```typescript
style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
```

### Custom Markers

- **User Markers**: Circular avatars with initials, color-coded by status
- **Current User**: Pulsing dot marker with high-accuracy indicator
- **Danger Zones**: GeoJSON polygons with level-based colors

### Status Colors

| Status | Color | Emoji |
|--------|-------|-------|
| Safe   | Green (#22c55e) | ✅ |
| Alert  | Orange (#f59e0b) | ⚠️ |
| Danger | Red (#ef4444) | 🚨 |

### Map Controls

- **Navigation Control**: Zoom in/out + compass
- **Scale Control**: Metric scale bar
- **Attribution Control**: Map data credits

## GPS Tracking Implementation

### Frontend (useEffect in Dashboard.tsx)

```typescript
navigator.geolocation.watchPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    
    // Update location state
    setLocation({ lat, lng });
    
    // Send to backend with throttling
    if (shouldSendLocation) {
      await api.locations.update({
        user_id: user.id,
        tourist_id: user.touristId,
        lat, lng,
        username: user.username,
        status,
      });
    }
  },
  (err) => { /* Handle errors */ },
  {
    enableHighAccuracy: true,  // Use GPS
    timeout: 10000,            // 10s timeout
    maximumAge: 10000          // Accept 10s old locations
  }
);
```

### Throttling Logic

Location updates are sent when:
- **5 seconds** have passed since last update, OR
- User moved **> 5 meters**, OR
- Status changed (safe/alert/danger)

This reduces API calls while maintaining real-time accuracy.

## Danger Zone Detection

### Automatic Status Updates

The backend automatically updates user status based on location:

1. **Inside Danger Zone** (distance ≤ radius):
   - Status → DANGER
   - Create emergency alert
   - Send notification

2. **Near Danger Zone** (distance ≤ 200m):
   - Status → ALERT
   - Create proximity alert
   - Send warning

3. **Outside All Zones**:
   - Status → SAFE (if no active alerts)

### Haversine Distance Calculation

```javascript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

## Real-time Updates with Socket.IO

### Backend Emission

```javascript
// In /api/locations POST endpoint
io.to('admin-room').emit('location-update', locationData);
io.to(`user-${tourist_id}`).emit('my-location-update', locationData);
```

### Frontend Subscription

```typescript
// useSocket hook
socket.on('location-update', (location) => {
  onLocationUpdate?.(location);
});

socket.on('my-location-update', (location) => {
  onMyLocationUpdate?.(location);
});
```

## Admin Dashboard Features

### Real-time Map View

- See all users on a single map
- Color-coded status indicators
- Live location updates via Socket.IO
- Danger zone overlays

### User Management

- View all registered tourists
- Delete users from blockchain
- Send notifications
- Monitor active alerts

### Danger Zone Management

- Add danger zones to blockchain
- Edit existing zones
- Remove zones (mark inactive)
- Visual map editor

## Troubleshooting

### GPS Not Working

1. Ensure browser has location permissions
2. Use HTTPS in production (GPS requires secure context)
3. Check browser console for geolocation errors
4. Try Chrome/Firefox (best GPS support)

### Map Not Loading

1. Check internet connection (tiles loaded from CDN)
2. Verify MapLibre GL CSS is imported
3. Check browser console for CORS errors
4. Ensure container has height (map needs dimensions)

### Socket.IO Not Connecting

1. Verify backend server is running on port 3000
2. Check VITE_API_BASE_URL in .env
3. Look for connection errors in browser console
4. Ensure CORS is configured correctly

### MongoDB Connection Issues

1. Check MongoDB is running: `mongod --version`
2. Verify MONGODB_URI in server/.env
3. Test connection: `mongosh mongodb://localhost:27017`
4. Check MongoDB logs for errors

## Performance Optimization

### Frontend

- **Throttling**: Location updates every 5 seconds or 5 meters
- **MapLibre GL**: Hardware-accelerated WebGL rendering
- **Marker Recycling**: Reuse marker instances instead of creating new ones
- **Lazy Loading**: Load map only when component mounts

### Backend

- **Socket.IO Rooms**: Efficient broadcasting to specific groups
- **MongoDB Indexes**: Indexed queries on user_id and tourist_id
- **Async Operations**: Non-blocking I/O for all database operations
- **Memory Management**: Clean up disconnected sockets

## Security Considerations

### GPS Spoofing

- Validate location accuracy (reject if > 100m)
- Cross-reference with previous locations
- Implement rate limiting on location updates

### API Security

- Authenticate all API requests
- Validate user permissions before updates
- Sanitize all input data
- Use HTTPS in production

### MongoDB Security

- Use authentication for production
- Enable MongoDB Atlas IP whitelist
- Never commit credentials to version control
- Regular backups

## Migration from Google Maps

### Before (Google Maps)

```typescript
import { GoogleMap, Marker } from '@react-google-maps/api';
```

### After (MapLibre GL JS)

```typescript
import maplibregl, { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
```

### Key Differences

| Feature | Google Maps | MapLibre GL JS |
|---------|-------------|----------------|
| Cost | Paid (after free tier) | Free (open-source) |
| Tiles | Google servers | OpenStreetMap/Custom |
| Customization | Limited | Full control |
| Offline | Limited | Full support possible |
| Privacy | Google tracking | Self-hosted option |

## Future Enhancements

- [ ] Offline map support with cached tiles
- [ ] Custom map styles (light theme, satellite)
- [ ] Geofencing with polygon zones
- [ ] Location history playback
- [ ] Heat maps for high-traffic areas
- [ ] Route optimization for safe paths
- [ ] Turn-by-turn navigation
- [ ] 3D buildings and terrain

## Support

For issues or questions:
1. Check this documentation
2. Review browser console logs
3. Check server logs in terminal
4. Verify environment variables
5. Test MongoDB connection

## License

This project uses MapLibre GL JS (BSD 3-Clause License) and OpenStreetMap data (ODbL License).

---

**Built with ❤️ using MapLibre GL JS, Socket.IO, MongoDB, and Blockchain**
