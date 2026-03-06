# 🚀 SafeHaven - Complete Usage Guide

## ✅ All Features Working!

- ✅ **MetaMask Wallet Integration** - Connect wallet to register
- ✅ **MongoDB Database** - All data stored in MongoDB
- ✅ **One Account Per Wallet** - Duplicate prevention enabled
- ✅ **Live Location Tracking** - Real-time location updates (2s polling)
- ✅ **Status Updates** - Safe/Alert/Danger status syncs to admin dashboard
- ✅ **Leaflet Maps** - Free OpenStreetMap integration
- ✅ **Admin Dashboard** - View all users, locations, and alerts

---

## 📋 Step-by-Step Setup

### 1. Start MongoDB
```bash
# Make sure MongoDB is running locally or use MongoDB Atlas
# Local: mongodb://localhost:27017/safehaven
# Atlas: mongodb+srv://...
```

### 2. Start Backend Server
```bash
cd server
npm install
npm run dev
```

Expected output:
```
✅ Connected to MongoDB
🚀 SafeHaven API Server running on http://localhost:3000
```

### 3. Start Frontend
```bash
npm install
npm run dev
```

Expected output:
```
VITE ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## 👤 User Registration Flow

### Step 1: Connect MetaMask
1. Go to **http://localhost:5173/signup**
2. Click **"Connect MetaMask"**
3. Approve connection in MetaMask
4. Wallet address will be shown

### Step 2: Fill Registration Form
1. Enter **Username** (this will be your tourist ID)
2. Enter **Email**
3. Enter **Phone Number**
4. Select **Date of Birth**
5. Create **Password** (min 6 characters)
6. Confirm **Password**
7. Click **"Create Account"**

### Step 3: Registration Complete!
- Your data is saved to MongoDB
- You'll be redirected to Tourist Dashboard
- Your wallet is now linked to your account

### ⚠️ Important: One Wallet = One Account
- Each MetaMask wallet can only register **once**
- If you try to register again with same wallet, you'll get an error
- This prevents duplicate accounts

---

## 🗺️ Tourist Dashboard Features

### Live Location Tracking
- Your location is automatically tracked
- Updates sent to MongoDB every **5 seconds**
- Shown on map with your status color

### Status Updates
- **SAFE** (Green) - Everything is fine
- **ALERT** (Yellow) - Need assistance
- **DANGER** (Red) - Emergency!

When you change status:
1. Status updates in MongoDB immediately
2. Admin dashboard shows the change in **real-time**
3. Your location marker color changes on map

### Danger Zone Alerts
- Automatic alerts when entering danger zones
- Proximity detection works in real-time
- Admin gets notified immediately

---

## 👨‍💼 Admin Dashboard Features

### Access Admin Dashboard
1. Go to **http://localhost:5173/admin-login**
2. Login with credentials
3. Connect MetaMask wallet
4. Use admin wallet: `0x548cb269df02005590CF48fb031dD697e52aa201`

### Live User Tracking Map
- Shows **ALL registered tourists** on map
- Color-coded by status:
  - 🟢 Green = Safe
  - 🟡 Yellow = Alert
  - 🔴 Red = Danger
- Updates every **2 seconds** automatically
- Click on markers to see user details

### Registered Tourists List
- Shows all users registered in MongoDB
- Live status badges (updates in real-time)
- User details: name, tourist ID, email, registration date
- **Notify** button to send alerts

### Active Alerts
- All emergency alerts from tourists
- Danger zone entry alerts
- Status change alerts
- Dismiss alerts when resolved

### Danger Zone Management
- Add new danger zones on map
- Set risk level (Low/Medium/High/Critical)
- Define radius in meters
- Remove zones when no longer needed

### Send Notifications
- Click **"Notify"** on any tourist
- Choose notification type:
  - ℹ️ Information
  - ⚠️ Warning
  - 🚨 Danger Alert
  - 🏃 Evacuation Order
- Type your message
- Send → Tourist receives it instantly

---

## 🔄 Real-Time Sync Architecture

### How It Works

```
User Dashboard          MongoDB          Admin Dashboard
     │                     │                    │
     ├─ Status Update ───► │ ◄── Polling (3s) ──┤
     │                     │                    │
     ├─ Location  ───────► │ ◄── Polling (2s) ──┤
     │   (every 5s)        │                    │
     │                     │                    │
     │                     │ ◄── Polling (5s) ──┤
     │                     │   (Profiles)       │
     │                     │                    │
     │                     │ ◄── Polling (5s) ──┤
     │                     │   (Notifications)  │
```

### Update Frequencies

| Data Type | Poll Interval | Direction |
|-----------|---------------|-----------|
| User Locations | 2 seconds | User → MongoDB → Admin |
| Status Updates | 3 seconds | User → MongoDB → Admin |
| User Profiles | 5 seconds | MongoDB → Both |
| Notifications | 5 seconds | Admin → MongoDB → User |
| Alerts | 3 seconds | User → MongoDB → Admin |
| Danger Zones | 10 seconds | MongoDB → Both |

---

## 🧪 Testing Scenarios

### Test 1: User Registration
1. Open browser in **Incognito Mode**
2. Go to `/signup`
3. Connect MetaMask
4. Fill form with unique username
5. Submit → Should succeed
6. Check MongoDB → Profile created

### Test 2: Duplicate Prevention
1. Try to register again with **same wallet**
2. Should get error: "Wallet address already registered"
3. Try with **different wallet** → Should succeed

### Test 3: Live Location
1. Login as tourist
2. Open Admin Dashboard in another tab
3. Walk around (or change location in dev tools)
4. Watch location update on admin map every 2 seconds

### Test 4: Status Updates
1. Login as tourist
2. Change status: SAFE → ALERT → DANGER
3. Check Admin Dashboard
4. Status should update within 3 seconds
5. User badge color should change

### Test 5: Danger Zone Entry
1. Admin creates danger zone
2. Tourist enters zone radius
3. Tourist gets alert popup
4. Admin sees new alert in dashboard
5. Tourist status changes to DANGER

### Test 6: Admin Notifications
1. Admin clicks "Notify" on a tourist
2. Sends warning message
3. Tourist receives notification popup
4. Notification badge appears
5. Tourist can mark as read

---

## 🛠️ Database Management

### Clear Database
```bash
cd server
npm run clear-db
```

This will delete:
- All user profiles
- All alerts
- All danger zones
- All locations
- All notifications

### View Database (MongoDB Compass)
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect to: `mongodb://localhost:27017`
3. Database: `safehaven`
4. Collections:
   - `profiles` - User data
   - `alerts` - Emergency alerts
   - `danger_zones` - Danger zones
   - `user_locations` - Live locations
   - `notifications` - Admin messages

---

## 📊 Data Flow Examples

### Example 1: User Registers
```
User clicks "Create Account"
  ↓
Frontend validates form
  ↓
API call: POST /api/register
  ↓
Server checks for duplicate wallet
  ↓
Server creates profile in MongoDB
  ↓
Profile saved with:
  - user_id (UUID)
  - tourist_id (username)
  - wallet_address
  - status: 'safe'
  ↓
Frontend redirects to /dashboard
```

### Example 2: User Updates Status
```
User clicks "ALERT" button
  ↓
Frontend updates local state
  ↓
API call: PATCH /api/users/:id/status
  ↓
MongoDB updates profile.status
  ↓
Admin polling fetches updated profiles
  ↓
Admin dashboard shows new status
  ↓
User badge changes color
```

### Example 3: Location Tracking
```
User's GPS updates (every 5s)
  ↓
Frontend sends: POST /api/locations
  ↓
MongoDB upserts user_location
  ↓
Server checks danger zones
  ↓
If in zone → Creates alert
  ↓
Admin polling fetches locations (every 2s)
  ↓
Map marker updates position
```

---

## 🎯 Key Features Summary

### ✅ Implemented
1. **MetaMask Wallet Connection** - Required for registration
2. **One Wallet = One Account** - Enforced at database level
3. **MongoDB Integration** - All data persisted
4. **Live Location Tracking** - 2-second updates
5. **Real-time Status Sync** - 3-second updates
6. **Danger Zone Detection** - Automatic alerts
7. **Admin Notifications** - Send alerts to tourists
8. **Leaflet Maps** - Free, no API key needed
9. **Duplicate Prevention** - Wallet & username checks
10. **Database Clear Tool** - Easy testing

### 🎨 UI Features
- Responsive design
- Dark theme
- Gradient effects
- Custom map markers
- Status-based coloring
- Real-time badges
- Toast notifications
- Loading states

---

## 🐛 Troubleshooting

### "Wallet already registered"
- This wallet was used before
- Use a different MetaMask account
- Or clear database: `npm run clear-db`

### Location not updating
- Check browser location permissions
- Ensure GPS is enabled
- Check console for errors
- Verify backend is running

### Admin not seeing users
- Check if backend is connected to MongoDB
- Verify polling is working (check console logs)
- Make sure user completed registration
- Check MongoDB has profiles

### Map not showing
- Check internet connection (OpenStreetMap)
- Clear browser cache
- Check console for Leaflet errors

---

## 📝 API Endpoints Reference

### Users
```bash
GET    /api/users              # Get all users
GET    /api/users/:id          # Get user by ID
PATCH  /api/users/:id/status   # Update status
POST   /api/register           # Register new user
```

### Locations
```bash
GET    /api/locations          # Get all locations
POST   /api/locations          # Update location
```

### Danger Zones
```bash
GET    /api/danger-zones       # Get all zones
POST   /api/danger-zones       # Create zone
DELETE /api/danger-zones/:id   # Delete zone
```

### Alerts
```bash
GET    /api/alerts             # Get active alerts
PATCH  /api/alerts/:id/dismiss # Dismiss alert
```

### Notifications
```bash
POST   /api/notifications            # Send notification
GET    /api/notifications/:touristId # Get notifications
PATCH  /api/notifications/:id/read   # Mark as read
```

---

## ✅ Success Checklist

- [ ] MongoDB running
- [ ] Backend server started (port 3000)
- [ ] Frontend started (port 5173)
- [ ] MetaMask installed
- [ ] User registered with wallet
- [ ] Profile saved to MongoDB
- [ ] Location tracking working
- [ ] Status updates syncing
- [ ] Admin dashboard showing users
- [ ] Map displaying correctly
- [ ] Notifications working

---

**Everything is ready! Start testing! 🚀**

For any issues, check:
1. Browser console (F12)
2. Backend terminal logs
3. MongoDB Compass for data
