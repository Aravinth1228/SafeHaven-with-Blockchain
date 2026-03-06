# 🧨 Complete Database Clear Guide

## ✅ Database Dropped Successfully!

MongoDB database `safehaven_sas` has been **completely deleted**.

---

## 🔄 Next Steps - DO THIS NOW:

### **Step 1: Restart Backend**

```bash
# Terminal 1 - Stop current backend (Ctrl+C)
cd server
npm run dev
```

**Wait for this output:**
```
✅ Connected to MongoDB
📊 MongoDB Database: safehaven_sas
🚀 SafeHaven API Server running on http://localhost:3000
```

---

### **Step 2: Clear Browser**

**Option A - Use Test Page:**
```
http://localhost:8080/test-admin.html
```
1. Click **"💣 Drop Database"** (already done!)
2. Click **"🧹 Clear All Data"**
3. Click **"👤 Set as Admin"**
4. Click **"📊 Go to Admin Dashboard"**

**Option B - Manual Clear:**
```javascript
// Open browser console (F12)
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

### **Step 3: Fresh Start**

1. **Open:** http://localhost:8080/signup
2. **Connect MetaMask** wallet
3. **Fill registration form:**
   - Username (new one)
   - Email
   - Phone (10 digits)
   - DOB
   - Password
   - Confirm Password
4. **Click "Create Account"**
5. **Auto-redirect to dashboard** ✅

---

### **Step 4: Test Everything**

**User Dashboard:**
- ✅ Username shows at top
- ✅ Current location shows
- ✅ Status buttons work (Safe/Alert/Danger)
- ✅ Location tracked automatically

**Admin Dashboard:**
```
http://localhost:8080/admin-login
```
1. Connect admin wallet
2. Should redirect to admin dashboard
3. Should see:
   - Stats (0 users initially)
   - Empty map
   - No alerts
   - No tourists

---

## 📊 Database Status

**Before:**
```
Database: safehaven_sas
Collections: profiles, alerts, danger_zones, user_locations, notifications
Documents: ??? (old data)
```

**After:**
```
Database: safehaven_sas
Collections: (empty - will be recreated on first use)
Documents: 0
```

---

## 🎯 Commands Reference

### **Drop Database (Complete Delete):**
```bash
cd server
npm run drop-db
```

### **Clear Collections (Keep Database):**
```bash
cd server
npm run clear-db
```

### **Via Test Page:**
```
http://localhost:8080/test-admin.html
- 💣 Drop Database = Complete delete
- 🧹 Clear All Data = Clear collections only
```

---

## 🐛 Troubleshooting

### **"User not found" Error:**
This means:
1. User registered in localStorage
2. But NOT in MongoDB

**Solution:**
- Drop database again
- Clear browser storage
- Register fresh user

### **Admin Dashboard Still Black:**
1. Check backend is running (port 3000)
2. Check console for errors (F12)
3. Use test-admin.html to verify

### **Can't Register:**
1. Clear browser storage
2. Use different username
3. Use different MetaMask wallet

---

## ✅ Success Indicators

**Backend Running:**
```
✅ Connected to MongoDB
📊 MongoDB Database: safehaven_sas
🚀 SafeHaven API Server running on http://localhost:3000
```

**Test Page Working:**
```
✅ Database DROPPED! All collections deleted.
✅ Browser storage cleared
```

**Fresh Registration:**
- User created in MongoDB
- Dashboard loads
- Location tracked
- Admin can see user

---

**Database is NOW completely clean! Start fresh!** 🚀
