const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/safehaven';

// ✅ FIX 1: Added Vercel URL to ALLOWED_ORIGINS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://safehaven-with-blockchain-1.onrender.com',
  'https://safehaven-eta.vercel.app',         // ✅ ADDED
  'https://www.safehaven-eta.vercel.app',      // ✅ ADDED
  process.env.FRONTEND_URL                     // ✅ from Render env variable
].filter(Boolean);

console.log('🔐 Allowed CORS origins:', ALLOWED_ORIGINS);

// ✅ FIX 2: CORS now accepts Vercel frontend
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked CORS origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const connectedClients = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log('📊 Admin joined real-time updates');
  });

  socket.on('join-user', (touristId) => {
    socket.join(`user-${touristId}`);
    console.log(`👤 User ${touristId} joined their room`);
  });

  socket.on('location-update', async (locationData) => {
    const { user_id, tourist_id, lat, lng, username, status } = locationData;

    console.log('📡 Socket.IO location update received:', {
      user_id,
      tourist_id,
      lat: lat?.toFixed(6),
      lng: lng?.toFixed(6),
      username,
      status,
    });

    try {
      let location = await UserLocation.findOne({ user_id });
      if (location) {
        location.lat = lat;
        location.lng = lng;
        if (status) location.status = status;
        location.updated_at = new Date();
        await location.save();
      } else {
        location = await UserLocation.create({
          user_id,
          tourist_id,
          lat,
          lng,
          username: username || 'Unknown',
          status: status || 'safe',
          updated_at: new Date()
        });
      }

      if (status) {
        await Profile.findOneAndUpdate(
          { user_id },
          { status, updated_at: new Date() }
        );
      }

      io.to('admin-room').emit('location-update', {
        user_id,
        tourist_id,
        lat,
        lng,
        username: username || 'Unknown',
        status: status || 'safe',
        updated_at: new Date().toISOString()
      });

      io.to(`user-${tourist_id}`).emit('my-location-update', {
        user_id,
        tourist_id,
        lat,
        lng,
        username: username || 'Unknown',
        status: status || 'safe',
        updated_at: new Date().toISOString()
      });

      console.log('📡 Broadcasted location to admin-room and user room');
    } catch (error) {
      console.error('❌ Error processing Socket.IO location update:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

module.exports.io = io;

app.use(express.json());

// ✅ FIX 3: MongoDB Connection with better error handling
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Initialize Blockchain Relayer
const relayer = require('./blockchain/relayer');
relayer.initialize().then(() => {
  console.log('✅ Blockchain Relayer initialized');
}).catch(err => {
  console.log('⚠️  Blockchain Relayer not initialized (contracts may not be deployed yet)');
});

// Import blockchain routes
const blockchainRoutes = require('./routes/blockchain');
const blockchainDangerZonesRoutes = require('./routes/blockchain-danger-zones');
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/blockchain/danger-zones', blockchainDangerZonesRoutes);

// Import models
const { Profile, Alert, DangerZone, UserLocation, Notification } = require('./models');

// Helper: Haversine distance formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Generate Tourist ID
function generateTouristId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TID-${timestamp}-${random}`;
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SafeHaven API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      locations: '/api/locations',
      alerts: '/api/alerts',
      dangerZones: '/api/danger-zones',
      blockchain: '/api/blockchain'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.json({
    status: 'OK',
    timestamp: new Date(),
    mongodb: mongoStatus,
    blockchain: relayer.isInitialized() ? 'Ready' : 'Not initialized',
    uptime: process.uptime().toFixed(2) + 's'
  });
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await Profile.find().sort({ created_at: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await Profile.findOne({ user_id: req.params.userId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user status
app.patch('/api/users/:userId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.params.userId;

    let user = await Profile.findOne({
      tourist_id: { $regex: new RegExp(`^${userId}$`, 'i') }
    });

    if (!user) {
      user = await Profile.findOne({ user_id: userId });
    }

    if (!user) {
      user = await Profile.findOne({
        wallet_address: { $regex: new RegExp(`^${userId}$`, 'i') }
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updatedUser = await Profile.findByIdAndUpdate(
      user._id,
      { status: status, updated_at: new Date() },
      { new: true, runValidators: false }
    );

    if (status === 'alert' || status === 'danger') {
      await Alert.create({
        user_id: updatedUser.user_id,
        tourist_id: updatedUser.tourist_id,
        username: updatedUser.username,
        status: status,
        alert_type: 'status_change',
      });
    }

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all danger zones
app.get('/api/danger-zones', async (req, res) => {
  try {
    const mongoZones = await DangerZone.find().sort({ created_at: -1 });
    console.log('📊 Loaded danger zones from MongoDB:', mongoZones.length);

    res.json({
      success: true,
      data: mongoZones.map(zone => ({
        id: zone._id,
        name: zone.name,
        lat: zone.lat,
        lng: zone.lng,
        radius: zone.radius,
        level: zone.level,
        created_by: zone.created_by,
        blockchain_zone_id: zone.blockchain_zone_id,
        blockchain_tx_hash: zone.blockchain_tx_hash,
        created_at: zone.created_at,
        isActive: true
      })),
      blockchainEnabled: relayer.isInitialized(),
      count: mongoZones.length,
      source: 'mongodb'
    });
  } catch (error) {
    console.error('Error getting danger zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create danger zone
app.post('/api/danger-zones', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by } = req.body;

    if (!name || lat === undefined || lng === undefined || !radius || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, lat, lng, radius, level'
      });
    }

    const dangerZone = await DangerZone.create({
      name, lat, lng, radius, level,
      created_by: created_by || 'admin',
      blockchain_zone_id: null,
      blockchain_tx_hash: null
    });

    console.log('✅ Danger zone created in MongoDB:', dangerZone._id);

    let blockchainResult = null;
    let blockchainEnabled = false;

    if (relayer.isInitialized()) {
      try {
        const latInt = Math.round(lat * 1e6);
        const lngInt = Math.round(lng * 1e6);
        const levelEnum = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }[level] || 1;

        blockchainResult = await relayer.createDangerZoneDirect(
          created_by || process.env.ADMIN_WALLET,
          name, latInt, lngInt, radius, levelEnum
        );

        await DangerZone.findByIdAndUpdate(dangerZone._id, {
          blockchain_zone_id: blockchainResult?.zoneId,
          blockchain_tx_hash: blockchainResult?.txHash
        });

        blockchainEnabled = true;
        console.log('✅ Danger zone also created on blockchain:', blockchainResult?.txHash);
      } catch (blockchainErr) {
        console.warn('⚠️ Blockchain creation failed (zone still created in MongoDB):', blockchainErr.message);
      }
    }

    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      if (distance <= radius) {
        await Profile.findOneAndUpdate(
          { user_id: user.user_id },
          { status: 'danger', updated_at: new Date() }
        );

        await Alert.create({
          user_id: user.user_id,
          tourist_id: user.tourist_id,
          username: user.username || 'Unknown',
          status: 'danger',
          alert_type: 'entered_danger_zone',
          lat: user.lat,
          lng: user.lng,
          zone_name: name,
          zone_level: level,
        });
        updatedUsers.push(user.username);
      } else if (distance <= 500) {
        const notification = await Notification.create({
          tourist_id: user.tourist_id,
          user_id: user.user_id,
          admin_wallet: created_by || 'admin',
          message: `⚠️ New danger zone "${name}" created ${Math.round(distance)}m from your location. Stay away!`,
          notification_type: 'warning',
        });
        notifications.push(notification);
      }
    }

    res.json({
      success: true,
      data: { id: dangerZone._id, name, lat, lng, radius, level, created_by: created_by || 'admin', isActive: true },
      blockchain: blockchainResult ? {
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber,
        zoneId: blockchainResult.zoneId
      } : null,
      blockchainEnabled,
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers,
      message: blockchainEnabled
        ? 'Danger zone created in MongoDB + Blockchain'
        : 'Danger zone created in MongoDB only (blockchain not available)'
    });
  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete danger zone
app.delete('/api/danger-zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mongoResult = await DangerZone.findByIdAndDelete(id);

    if (!mongoResult) {
      return res.status(404).json({ success: false, error: 'Danger zone not found in MongoDB' });
    }

    let blockchainDeleted = false;
    let blockchainResult = null;

    if (relayer.isInitialized() && mongoResult.blockchain_zone_id) {
      try {
        const blockchainIndex = parseInt(mongoResult.blockchain_zone_id.replace('ZONE-', ''));
        if (!isNaN(blockchainIndex)) {
          blockchainResult = await relayer.removeDangerZone(process.env.ADMIN_WALLET, blockchainIndex);
          blockchainDeleted = true;
        }
      } catch (blockchainErr) {
        console.warn('⚠️ Blockchain deletion failed:', blockchainErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Danger zone deleted',
      mongodbDeleted: true,
      blockchainDeleted,
      blockchain: blockchainResult ? {
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber
      } : null
    });
  } catch (error) {
    console.error('Delete danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all active alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find({ dismissed: false }).sort({ created_at: -1 });
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dismiss alert
app.patch('/api/alerts/:alertId/dismiss', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.alertId,
      { dismissed: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user location
app.post('/api/locations', async (req, res) => {
  try {
    const { user_id, tourist_id, lat, lng, username, status } = req.body;

    console.log('📍 Location update received:', { user_id, tourist_id, lat, lng, username: username || 'NOT_PROVIDED', status });
    console.log('📍 Processing location:', lat.toFixed(6), lng.toFixed(6));

    let location = await UserLocation.findOne({ user_id });
    if (location) {
      location.lat = lat;
      location.lng = lng;
      if (status) location.status = status;
      location.updated_at = new Date();
      await location.save();
    } else {
      location = await UserLocation.create({
        user_id, tourist_id, lat, lng,
        username: username || 'Unknown',
        status: status || 'safe'
      });
    }

    if (status) {
      await Profile.findOneAndUpdate(
        { user_id },
        { status, updated_at: new Date() }
      );
    }

    const locationData = {
      user_id, tourist_id, lat, lng,
      username: username || 'Unknown',
      status: status || 'safe',
      updated_at: new Date().toISOString()
    };

    io.to('admin-room').emit('location-update', locationData);
    io.to(`user-${tourist_id}`).emit('my-location-update', locationData);
    console.log('📡 Emitted location update to admin-room:', locationData.username);

    // ✅ FIX 4: Use Render backend URL instead of localhost
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    let zones = [];
    try {
      const blockchainResponse = await fetch(`${backendUrl}/api/blockchain/danger-zones`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const blockchainData = await blockchainResponse.json();
      if (blockchainData.success) {
        zones = blockchainData.data || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch danger zones from blockchain:', error.message);
    }

    let isInAnyDangerZone = false;
    let isNearAnyDangerZone = false;

    for (const zone of zones) {
      const distance = calculateDistance(lat, lng, zone.lat, zone.lng);

      if (distance <= zone.radius) {
        isInAnyDangerZone = true;

        const existingAlert = await Alert.findOne({
          user_id, zone_name: zone.name,
          alert_type: 'entered_danger_zone',
          dismissed: false
        });

        if (!existingAlert) {
          await Alert.create({
            user_id, tourist_id,
            username: username || 'Unknown',
            status: status || 'safe',
            alert_type: 'entered_danger_zone',
            lat, lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });
          console.log(`🚨 ALERT CREATED: User ${username || 'Unknown'} entered ${zone.name}`);
        }
      } else if (distance <= 200 && distance > zone.radius) {
        isNearAnyDangerZone = true;

        const existingProximityAlert = await Alert.findOne({
          user_id, zone_name: zone.name,
          alert_type: 'near_danger_zone',
          dismissed: false
        });

        if (!existingProximityAlert) {
          await Alert.create({
            user_id, tourist_id,
            username: username || 'Unknown',
            status: status || 'safe',
            alert_type: 'near_danger_zone',
            lat, lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });
          console.log(`⚠️ PROXIMITY ALERT: User ${username || 'Unknown'} is within 200m of ${zone.name}`);
        }
      }
    }

    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, phone, dob, wallet_address, tourist_id, user_id, password, lat, lng } = req.body;

    const existingWallet = await Profile.findOne({ wallet_address });
    if (existingWallet) {
      return res.status(400).json({ success: false, error: 'Wallet address already registered' });
    }

    const existingUsername = await Profile.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (existingUsername) {
      const updatedProfile = await Profile.findOneAndUpdate(
        { _id: existingUsername._id },
        {
          wallet_address,
          email: email || existingUsername.email,
          phone: phone || existingUsername.phone,
          dob: dob || existingUsername.dob,
          password: password || existingUsername.password,
          updated_at: new Date()
        },
        { new: true }
      );
      return res.json({ success: true, data: updatedProfile, message: 'Existing user updated with new wallet address' });
    }

    const existingTourist = await Profile.findOne({ tourist_id });
    if (existingTourist) {
      return res.status(400).json({ success: false, error: 'Tourist ID already exists. Please try again.' });
    }

    const finalTouristId = tourist_id || generateTouristId();
    const finalUserId = user_id || new mongoose.Types.ObjectId().toString();

    const profile = await Profile.create({
      user_id: finalUserId,
      tourist_id: finalTouristId,
      username, email, phone, dob, password,
      wallet_address,
      status: 'safe',
    });

    if (lat !== undefined && lng !== undefined) {
      await UserLocation.create({
        user_id: finalUserId,
        tourist_id: finalTouristId,
        lat, lng, username,
        status: 'safe',
        updated_at: new Date()
      });

      io.to('admin-room').emit('location-update', {
        user_id: finalUserId,
        tourist_id: finalTouristId,
        lat, lng,
        username: username || 'Unknown',
        status: 'safe',
        updated_at: new Date().toISOString()
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const user = await Profile.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json({ success: true, data: userWithoutPassword, message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const profileResult = await Profile.deleteOne({ user_id: userId });
    const alertsResult = await Alert.deleteMany({ user_id: userId });
    const locationsResult = await UserLocation.deleteOne({ user_id: userId });

    const profile = await Profile.findOne({ user_id: userId });
    let notificationsResult = { deletedCount: 0 };
    if (profile) {
      notificationsResult = await Notification.deleteMany({ tourist_id: profile.tourist_id });
    }

    res.json({
      success: true,
      message: 'User deleted from MongoDB',
      deleted: {
        profile: profileResult.deletedCount,
        alerts: alertsResult.deletedCount,
        locations: locationsResult.deletedCount ? 1 : 0,
        notifications: notificationsResult.deletedCount,
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const profiles = await Profile.find();
    const alerts = await Alert.find({ dismissed: false });

    res.json({
      success: true,
      data: {
        total_users: profiles.length,
        safe_users: profiles.filter(p => p.status === 'safe').length,
        alert_users: profiles.filter(p => p.status === 'alert').length,
        danger_users: profiles.filter(p => p.status === 'danger').length,
        active_alerts: alerts.length,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test users
app.delete('/api/users/delete-test-users', async (req, res) => {
  try {
    const { confirm } = req.query;

    if (confirm !== 'true') {
      return res.status(400).json({ success: false, error: 'Confirmation required. Add ?confirm=true to proceed' });
    }

    const testUsers = await Profile.find({
      $or: [
        { username: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } },
        { email: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } },
        { tourist_id: { $regex: 'test|demo|fake|dummy|temp|sample|example', $options: 'i' } }
      ]
    });

    if (testUsers.length === 0) {
      return res.json({ success: true, message: 'No test users found', deleted: 0 });
    }

    const result = await Profile.deleteMany({ _id: { $in: testUsers.map(u => u._id) } });
    await UserLocation.deleteMany({ user_id: { $in: testUsers.map(u => u.user_id) } });
    await Alert.deleteMany({ user_id: { $in: testUsers.map(u => u.user_id) } });
    await Notification.deleteMany({ tourist_id: { $in: testUsers.map(u => u.tourist_id) } });

    res.json({ success: true, message: `Successfully deleted ${testUsers.length} test users`, deleted: testUsers.length, details: result });
  } catch (error) {
    console.error('Error deleting test users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications
app.post('/api/notifications', async (req, res) => {
  try {
    const { tourist_id, user_id, admin_wallet, message, notification_type } = req.body;
    const notification = await Notification.create({
      tourist_id, user_id, admin_wallet, message,
      notification_type: notification_type || 'warning',
    });
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/:touristId', async (req, res) => {
  try {
    const notifications = await Notification.find({ tourist_id: req.params.touristId }).sort({ created_at: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await UserLocation.find().sort({ updated_at: -1 });

    const locationsWithProfiles = await Promise.all(
      locations.map(async (loc) => {
        const profile = await Profile.findOne({ user_id: loc.user_id });
        return {
          ...loc.toObject(),
          username: loc.username || profile?.username || 'Unknown',
          status: profile?.status || loc.status || 'safe'
        };
      })
    );

    res.json({ success: true, data: locationsWithProfiles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete location
app.delete('/api/locations/:locationId', async (req, res) => {
  try {
    await UserLocation.findByIdAndDelete(req.params.locationId);
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all DB collections
app.post('/api/clear-db', async (req, res) => {
  try {
    const results = await Promise.all([
      Profile.deleteMany({}),
      Alert.deleteMany({}),
      DangerZone.deleteMany({}),
      UserLocation.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    res.json({
      success: true,
      message: 'Database cleared',
      deleted: {
        profiles: results[0].deletedCount,
        alerts: results[1].deletedCount,
        dangerZones: results[2].deletedCount,
        locations: results[3].deletedCount,
        notifications: results[4].deletedCount,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all locations
app.post('/api/clear-locations', async (req, res) => {
  try {
    const result = await UserLocation.deleteMany({});
    res.json({ success: true, message: 'All locations cleared', deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Drop database
app.post('/api/drop-db', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    res.json({ success: true, message: 'Database dropped successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 SafeHaven API Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB Database: safehaven_sas`);
  console.log(`🔗 Connection: ${MONGODB_URI}`);
  console.log(`🔌 Socket.IO ready for real-time updates`);

  if (relayer.isInitialized()) {
    const deploymentInfo = relayer.getDeploymentInfo();
    console.log(`⛓️  Blockchain: ${deploymentInfo.network} (Chain ID: ${deploymentInfo.chainId})`);
    console.log(`📝 Contract: ${relayer.contractAddress}`);
    console.log(`🔐 Forwarder: ${relayer.forwarderAddress}`);
    console.log(`💼 Relayer: ${relayer.wallet.address}`);
  } else {
    console.log('⚠️  Blockchain: Not configured (run contract deployment)');
  }
});