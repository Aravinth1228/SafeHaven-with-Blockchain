# 🛠️ Admin Dashboard - Black Screen Fix

## ✅ Problem Fixed!

Admin dashboard black screen varudhu fix panna, indha steps follow pannu:

---

## 🔧 Step-by-Step Fix

### **Step 1: Clear Everything**

1. **Open:** http://localhost:5173/clear-data.html
2. **Click:** "Clear All Data" button
3. **Wait:** Auto-redirect aagum

### **Step 2: Restart Backend**

```bash
# Terminal 1
cd server
npm run dev
```

**Expected output:**
```
✅ Connected to MongoDB
🚀 SafeHaven API Server running on http://localhost:3000
```

### **Step 3: Restart Frontend**

```bash
# Terminal 2
npm run dev
```

**Expected output:**
```
VITE ready in xxx ms
➜  Local:   http://localhost:5173/
```

### **Step 4: Fresh Login**

1. **Open:** http://localhost:5173/admin-login
2. **Connect MetaMask** wallet
3. **Use admin wallet:** `0x548cb269df02005590CF48fb031dD697e52aa201`
4. **Wait** for verification
5. **Should redirect** to /admin

---

## 🐛 Debug Console La Enna Theriyudhu Nu Paaru

### **Browser Console Open Pannu (F12)**

Admin dashboard open panna pinadi console la indha messages theriyum:

```
🔄 Loading admin dashboard data...
📊 Data loaded: { users: 0, alerts: 0, zones: 0 }
```

### **Error Vanna:**

```
❌ Error loading data: Failed to fetch
```

**Solution:**
- Backend running ah nu paaru (port 3000)
- MongoDB running ah nu paaru

---

## 🧪 Test Admin Dashboard

### **1. Check Backend API:**

Open browser:
- http://localhost:3000/api/health

**Should show:**
```json
{
  "status": "OK",
  "timestamp": "2026-03-04T..."
}
```

### **2. Check MongoDB:**

MongoDB Compass open panni paaru:
```
Database: safehaven
Collections should exist:
- profiles
- alerts
- danger_zones
- user_locations
- notifications
```

### **3. Check Admin Route:**

URL should be: `http://localhost:5173/admin` (NOT /admin-dashboard)

---

## 💡 Common Issues & Solutions

### **Issue 1: Backend Not Running**

**Error:**
```
Failed to fetch
Network Error
```

**Solution:**
```bash
cd server
npm run dev
```

---

### **Issue 2: MongoDB Not Connected**

**Error:**
```
MongoServerError: connect ECONNREFUSED
```

**Solution:**
- Start MongoDB service
- Or check connection string in `server/.env`

---

### **Issue 3: Admin Not Authorized**

**Error:**
```
Access Denied - Not an admin
```

**Solution:**
- Use correct wallet: `0x548cb269df02005590CF48fb031dD697e52aa201`
- Or register this wallet as admin in smart contract

---

### **Issue 4: Old Data in Browser**

**Symptoms:**
- Dashboard loads but shows old data
- Or black screen

**Solution:**
```javascript
// Run in browser console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## 📊 Admin Dashboard Features

Once working, you should see:

### **Top Section:**
- Admin Dashboard title
- Database connection status
- Refresh button
- Wallet address display
- Logout button

### **Stats Grid:**
- Total Users
- Safe Users (Green)
- Alert Users (Yellow)
- Danger Users (Red)

### **Live Map:**
- Shows ALL users on map
- Color-coded markers
- Updates every 2 seconds

### **Active Alerts:**
- Emergency alerts from tourists
- Danger zone entries
- Dismiss button for each alert

### **Registered Tourists:**
- List of all users
- Live status badges
- Notify button

### **Danger Zones:**
- List of all danger zones
- Add new zone button
- Delete zone button

---

## 🎯 Quick Test

### **1. Clear & Restart:**
```bash
# Terminal 1 - Clear DB
cd server
node clear-db.js

# Terminal 2 - Start backend
cd server
npm run dev

# Terminal 3 - Start frontend
npm run dev
```

### **2. Create Test User:**
1. Open: http://localhost:5173/signup
2. Connect MetaMask
3. Fill form
4. Submit → Redirects to dashboard
5. Change status to ALERT

### **3. Check Admin:**
1. Open: http://localhost:5173/admin-login
2. Connect admin wallet
3. Should see dashboard
4. Should see the user on map
5. Should see the alert

---

## 📝 Console Commands

### **Check if Backend is Running:**
```javascript
fetch('http://localhost:3000/api/health')
  .then(r => r.json())
  .then(d => console.log('Backend:', d));
```

### **Check API Data:**
```javascript
fetch('http://localhost:3000/api/users')
  .then(r => r.json())
  .then(d => console.log('Users:', d));
```

### **Clear LocalStorage:**
```javascript
localStorage.clear();
location.reload();
```

---

## ✅ Success Indicators

### **Admin Dashboard Working:**
- ✅ See stats (Total Users, Safe, Alert, Danger)
- ✅ See map with user markers
- ✅ See Active Alerts section
- ✅ See Registered Tourists list
- ✅ See Danger Zones section
- ✅ Refresh button works
- ✅ Logout button works

### **Data Loading:**
```
Console should show:
🔄 Loading admin dashboard data...
📊 Data loaded: { users: 1, alerts: 1, zones: 0 }
```

---

## 🚀 Final Solution

If STILL black screen:

1. **Stop everything** (Ctrl+C in all terminals)
2. **Clear MongoDB:**
   ```bash
   cd server
   node clear-db.js
   ```
3. **Clear browser:**
   - http://localhost:5173/clear-data.html
   - Click "Clear All Data"
4. **Restart backend:**
   ```bash
   cd server
   npm run dev
   ```
5. **Restart frontend:**
   ```bash
   npm run dev
   ```
6. **Hard refresh browser:**
   - Ctrl + Shift + R (Windows)
   - Cmd + Shift + R (Mac)
7. **Try admin login again**

---

**Problem innum iruntha, console output send pannu!** 🛠️
