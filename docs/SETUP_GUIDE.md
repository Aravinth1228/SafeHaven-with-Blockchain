# SafeHaven - Tourist Safety System

## 🚀 Technology Stack Changes

### Backend (NEW)
- **Node.js + Express** - REST API server
- **MongoDB (mongoose)** - Database
- **Replaces:** Supabase

### Frontend
- **Leaflet.js + OpenStreetMap** - Interactive maps
- **Replaces:** Mapbox

## 📋 Setup Instructions

### Prerequisites
1. **Node.js** (v18 or higher)
2. **MongoDB** - Either:
   - Local MongoDB installation
   - MongoDB Atlas (cloud) account

### 1. Install Dependencies

```bash
# Install all dependencies at once
npm run install:all

# OR manually:
# Frontend
npm install

# Backend
cd server
npm install
```

### 2. Configure MongoDB

#### Option A: Local MongoDB
1. Install MongoDB locally from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Start MongoDB service
3. Create `.env` file in `server/` folder:

```env
MONGODB_URI=mongodb://localhost:27017/safehaven
PORT=3000
```

#### Option B: MongoDB Atlas (Cloud)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get your connection string
4. Create `.env` file in `server/` folder:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/safehaven?retryWrites=true&w=majority
PORT=3000
```

### 3. Configure Frontend

Create `.env` file in the root folder:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## 🏃 Running the Application

### Terminal 1: Start Backend Server
```bash
npm run server
```

The API server will run on `http://localhost:3000`

### Terminal 2: Start Frontend
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## 📁 Project Structure

```
SafeHeaven/
├── server/                 # Node.js Backend
│   ├── index.js           # Express server with all routes
│   ├── package.json
│   └── .env.example
├── src/                   # React Frontend
│   ├── components/
│   │   ├── LeafletMap.tsx        # NEW: OpenStreetMap integration
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.tsx       # Updated: No Supabase
│   ├── hooks/
│   │   ├── useRealtimeAlerts.ts  # Updated: Polling instead of realtime
│   │   ├── useRealtimeLocations.ts
│   │   ├── useRealtimeProfiles.ts
│   │   ├── useRealtimeNotifications.ts
│   │   ├── useDangerZoneDetection.ts
│   │   └── useSendLocation.ts
│   ├── lib/
│   │   └── api.ts         # Updated: Node.js API calls
│   ├── pages/
│   │   ├── AdminDashboard.tsx    # Updated: Leaflet + MongoDB
│   │   ├── Dashboard.tsx         # Updated: Leaflet + MongoDB
│   │   └── ...
│   └── ...
├── .env                   # Frontend environment
└── package.json
```

## 🔧 API Endpoints

### Authentication & Users
- `POST /api/register` - Register new tourist
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get user by ID
- `PATCH /api/users/:userId/status` - Update user status

### Danger Zones
- `GET /api/danger-zones` - Get all danger zones
- `POST /api/danger-zones` - Create danger zone
- `DELETE /api/danger-zones/:id` - Delete danger zone

### Alerts
- `GET /api/alerts` - Get all active alerts
- `PATCH /api/alerts/:alertId/dismiss` - Dismiss alert

### Locations
- `GET /api/locations` - Get all user locations
- `POST /api/locations` - Update user location (auto-creates alerts for danger zones)

### Notifications
- `POST /api/notifications` - Send notification
- `GET /api/notifications/:touristId` - Get notifications for user
- `PATCH /api/notifications/:id/read` - Mark as read

### Analytics
- `GET /api/analytics` - Get system analytics

## 🗺️ Map Features

### Leaflet.js + OpenStreetMap
- **No API key required** (unlike Mapbox)
- Dark matter tiles from CARTO
- Custom user markers with status colors
- Danger zone circles with different levels
- Real-time location tracking
- Popup information on click

### Map Legend
- 🟢 Green = Safe tourists
- 🟡 Yellow = Alert tourists  
- 🔴 Red = Danger tourists
- Colored circles = Danger zones (High/Medium/Low risk)

## 🔄 Real-time Updates

Since we're not using Supabase realtime anymore, the app uses **polling**:

- **Locations:** Every 2 seconds
- **Alerts:** Every 3 seconds
- **Profiles:** Every 5 seconds
- **Notifications:** Every 5 seconds

This provides near real-time experience without WebSocket complexity.

## 📊 Database Schema

### Collections

#### `profiles`
```javascript
{
  user_id: String,
  tourist_id: String,
  username: String,
  email: String,
  phone: String,
  dob: String,
  wallet_address: String,
  status: 'safe' | 'alert' | 'danger',
  created_at: Date,
  updated_at: Date
}
```

#### `alerts`
```javascript
{
  user_id: String,
  tourist_id: String,
  username: String,
  status: String,
  lat: Number,
  lng: Number,
  zone_name: String,
  zone_level: String,
  alert_type: String,
  dismissed: Boolean,
  created_at: Date
}
```

#### `danger_zones`
```javascript
{
  name: String,
  lat: Number,
  lng: Number,
  radius: Number,
  level: 'Low' | 'Medium' | 'High' | 'Critical',
  created_by: String,
  created_at: Date
}
```

#### `user_locations`
```javascript
{
  user_id: String,
  tourist_id: String,
  lat: Number,
  lng: Number,
  status: String,
  updated_at: Date
}
```

#### `notifications`
```javascript
{
  tourist_id: String,
  user_id: String,
  admin_wallet: String,
  message: String,
  notification_type: String,
  read: Boolean,
  created_at: Date
}
```

## 🎯 Key Features

### Tourist Dashboard
- Real-time location sharing
- Status updates (Safe/Alert/Danger)
- Interactive map with danger zones
- Danger zone proximity alerts
- Admin notifications

### Admin Dashboard
- Live user tracking map
- All registered tourists list
- Active alerts monitoring
- Danger zone management
- Send notifications to tourists
- Real-time statistics

## 🔐 Default Admin

The following wallet address is hardcoded as admin:
```
0x548cb269df02005590CF48fb031dD697e52aa201
```

## 🛠️ Development

### Build Frontend
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Preview Production Build
```bash
npm run preview
```

## 📝 Migration Notes

### What Changed
1. ✅ **Supabase → MongoDB**: All data now stored in MongoDB
2. ✅ **Mapbox → Leaflet**: Free, open-source mapping
3. ✅ **Realtime → Polling**: Simpler architecture
4. ✅ **Edge Functions → Express API**: Full control over backend

### What Stayed the Same
- User interface and experience
- Core functionality
- Authentication flow
- Wallet integration
- Alert system

## 🐛 Troubleshooting

### Backend won't start
- Check if MongoDB is running
- Verify connection string in `.env`
- Check port 3000 is not in use

### Maps not showing
- Check internet connection (OpenStreetMap tiles)
- Clear browser cache
- Check browser console for errors

### Location not tracking
- Enable location permissions in browser
- Use HTTPS in production
- Check browser geolocation support

## 📞 Support

For issues or questions, please check:
1. MongoDB logs
2. Browser console
3. Network tab in DevTools

---

**Built with ❤️ using Node.js, MongoDB, React, and Leaflet**
