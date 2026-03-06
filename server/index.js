const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/safehaven';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

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

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Generate Tourist ID
function generateTouristId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TID-${timestamp}-${random}`;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
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

    // Try to find by user_id first, then by wallet_address
    let user = await Profile.findOne({ user_id: userId });

    // If not found, try searching by wallet address (case-insensitive)
    if (!user) {
      user = await Profile.findOne({
        wallet_address: { $regex: new RegExp(`^${userId}$`, 'i') }
      });
    }

    // If still not found, try searching by tourist_id (case-insensitive)
    if (!user) {
      user = await Profile.findOne({
        tourist_id: { $regex: new RegExp(`^${userId}$`, 'i') }
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.status = status;
    user.updated_at = new Date();
    await user.save();

    // Create alert if status is alert/danger
    if (status === 'alert' || status === 'danger') {
      await Alert.create({
        user_id: user.user_id,
        tourist_id: user.tourist_id,
        username: user.username,
        status: status,
        alert_type: 'status_change',
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all danger zones - NOW FROM BLOCKCHAIN
app.get('/api/danger-zones', async (req, res) => {
  try {
    // Check if blockchain relayer is initialized
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Get all danger zones from blockchain
    const zones = await relayer.getAllDangerZones();

    // Level enum mapping (0=Low, 1=Medium, 2=High, 3=Critical)
    const levelNames = ['Low', 'Medium', 'High', 'Critical'];

    // Format zones for frontend
    const formattedZones = zones.map((zone, index) => ({
      id: zone.zoneId || `zone-${index}`,
      blockchainIndex: index,
      zoneId: zone.zoneId,
      name: zone.name,
      lat: Number(zone.latitude) / 1e6, // Convert from int256 * 1e6
      lng: Number(zone.longitude) / 1e6,
      radius: Number(zone.radius),
      level: levelNames[parseInt(zone.level)] || 'Medium',
      createdBy: zone.createdBy,
      createdAt: new Date(Number(zone.createdAt) * 1000),
      isActive: zone.isActive
    }));

    res.json({
      success: true,
      data: formattedZones,
      blockchainEnabled: true,
      count: formattedZones.length
    });
  } catch (error) {
    console.error('Error getting danger zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create danger zone - NOW ON BLOCKCHAIN
app.post('/api/danger-zones', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by } = req.body;

    // Check if blockchain relayer is initialized
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Validate input
    if (!name || lat === undefined || lng === undefined || !radius || !level) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, lat, lng, radius, level'
      });
    }

    // Convert coordinates to int256 * 1e6 format for blockchain
    const latInt = Math.round(lat * 1e6);
    const lngInt = Math.round(lng * 1e6);

    // Convert level string to enum number (Low=0, Medium=1, High=2, Critical=3)
    const levelEnum = { 'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3 }[level] || 1;

    // Create danger zone on blockchain
    const blockchainResult = await relayer.createDangerZoneDirect(
      created_by || process.env.ADMIN_WALLET,
      name,
      latInt,
      lngInt,
      radius,
      levelEnum
    );

    // Check if any users are inside or near this new zone (for notifications only)
    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];
    const emergencyAlerts = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      // If user is INSIDE the danger zone
      if (distance <= radius) {
        // Update profile status to DANGER
        await Profile.findOneAndUpdate(
          { user_id: user.user_id },
          { status: 'danger', updated_at: new Date() }
        );

        // Create emergency alert in MongoDB (for display purposes)
        const alert = await Alert.create({
          user_id: user.user_id,
          tourist_id: user.tourist_id,
          username: user.username || 'Unknown',
          status: 'danger',
          alert_type: 'entered_danger_zone',
          lat: user.lat,
          lng: user.lng,
          zone_name: name,
          zone_level: level,
          blockchain_zone_id: blockchainResult?.zoneId,
          blockchain_tx_hash: blockchainResult?.txHash
        });
        emergencyAlerts.push(alert);

        // Send emergency notification
        const notification = await Notification.create({
          tourist_id: user.tourist_id,
          user_id: user.user_id,
          admin_wallet: created_by || 'admin',
          message: `🚨 EMERGENCY! You are inside danger zone "${name}". Exit immediately!`,
          notification_type: 'danger',
        });
        notifications.push(notification);
        updatedUsers.push(user.username);

        console.log(`🚨 EMERGENCY: User ${user.username} is INSIDE ${name} - Status set to DANGER`);
      }
      // If user is within 500m but outside zone
      else if (distance <= 500) {
        const notification = await Notification.create({
          tourist_id: user.tourist_id,
          user_id: user.user_id,
          admin_wallet: created_by || 'admin',
          message: `⚠️ New danger zone "${name}" created ${Math.round(distance)}m from your location. Stay away!`,
          notification_type: 'warning',
        });
        notifications.push(notification);

        console.log(`⚠️ User ${user.username} is within 500m of ${name}`);
      }
    }

    res.json({
      success: true,
      data: {
        id: blockchainResult?.zoneId,
        blockchainIndex: blockchainResult?.zoneIndex,
        zoneId: blockchainResult?.zoneId,
        name,
        lat,
        lng,
        radius,
        level,
        createdBy: created_by,
        isActive: true
      },
      blockchain: {
        txHash: blockchainResult?.txHash,
        blockNumber: blockchainResult?.blockNumber,
        zoneId: blockchainResult?.zoneId
      },
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers,
      blockchainEnabled: true,
      message: 'Danger zone created on blockchain'
    });
  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete danger zone - FROM BLOCKCHAIN
app.delete('/api/danger-zones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extract blockchain index from id (format: "zone-{index}")
    const blockchainIndex = parseInt(id.replace('zone-', ''));
    
    if (isNaN(blockchainIndex)) {
      return res.status(400).json({ success: false, error: 'Invalid zone ID format' });
    }

    // Remove danger zone from blockchain
    const result = await relayer.removeDangerZone(process.env.ADMIN_WALLET, blockchainIndex);

    res.json({
      success: true,
      data: {
        blockchainIndex,
        removed: true
      },
      blockchain: {
        txHash: result?.txHash,
        blockNumber: result?.blockNumber
      },
      blockchainEnabled: true,
      message: 'Danger zone removed from blockchain'
    });
  } catch (error) {
    console.error('Remove danger zone error:', error);
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

    // Upsert location
    let location = await UserLocation.findOne({ user_id });
    if (location) {
      location.lat = lat;
      location.lng = lng;
      if (status) location.status = status;
      location.updated_at = new Date();
      await location.save();
    } else {
      location = await UserLocation.create({ user_id, tourist_id, lat, lng, status: status || 'safe' });
    }

    // Update profile status if provided
    if (status) {
      await Profile.findOneAndUpdate(
        { user_id },
        { status, updated_at: new Date() }
      );
    }

    // Check if user is in danger zone OR nearby (within 200m)
    const zones = await DangerZone.find();
    for (const zone of zones) {
      const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
      
      // User entered danger zone
      if (distance <= zone.radius) {
        // Check if alert already exists for this zone entry
        const existingAlert = await Alert.findOne({
          user_id,
          zone_name: zone.name,
          alert_type: 'entered_danger_zone',
          dismissed: false
        });

        if (!existingAlert) {
          // Create alert
          await Alert.create({
            user_id,
            tourist_id,
            username: username || 'Unknown',
            status: 'danger',
            alert_type: 'entered_danger_zone',
            lat,
            lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });

          // Update profile status
          await Profile.findOneAndUpdate(
            { user_id },
            { status: 'danger', updated_at: new Date() }
          );
        }
      }
      
      // User is within 200m of danger zone (proximity alert)
      if (distance <= 200 && distance > zone.radius) {
        const existingProximityAlert = await Alert.findOne({
          user_id,
          zone_name: zone.name,
          alert_type: 'near_danger_zone',
          dismissed: false
        });

        if (!existingProximityAlert) {
          // Create proximity alert
          await Alert.create({
            user_id,
            tourist_id,
            username: username || 'Unknown',
            status: 'alert',
            alert_type: 'near_danger_zone',
            lat,
            lng,
            zone_name: zone.name,
            zone_level: zone.level,
          });

          console.log(`⚠️ User ${username} is within 200m of ${zone.name}`);
        }
      }
    }

    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register new user/tourist profile
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, phone, dob, wallet_address, tourist_id, user_id } = req.body;

    // Check if wallet address already exists
    const existingWallet = await Profile.findOne({ wallet_address });
    if (existingWallet) {
      return res.status(400).json({ 
        success: false, 
        error: 'Wallet address already registered' 
      });
    }

    // Check if tourist_id already exists
    const existingTourist = await Profile.findOne({ tourist_id });
    if (existingTourist) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username already taken' 
      });
    }

    const finalTouristId = tourist_id || generateTouristId();
    const finalUserId = user_id || new mongoose.Types.ObjectId().toString();

    const profile = await Profile.create({
      user_id: finalUserId,
      tourist_id: finalTouristId,
      username,
      email,
      phone,
      dob,
      wallet_address,
      status: 'safe',
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const profiles = await Profile.find();
    const alerts = await Alert.find({ dismissed: false });

    const stats = {
      total_users: profiles.length,
      safe_users: profiles.filter(p => p.status === 'safe').length,
      alert_users: profiles.filter(p => p.status === 'alert').length,
      danger_users: profiles.filter(p => p.status === 'danger').length,
      active_alerts: alerts.length,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications
app.post('/api/notifications', async (req, res) => {
  try {
    const { tourist_id, user_id, admin_wallet, message, notification_type } = req.body;
    const notification = await Notification.create({
      tourist_id,
      user_id,
      admin_wallet,
      message,
      notification_type: notification_type || 'warning',
    });
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/:touristId', async (req, res) => {
  try {
    const notifications = await Notification.find({ tourist_id: req.params.touristId })
      .sort({ created_at: -1 });
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
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all database collections (for testing)
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

// Drop entire database (for testing)
app.post('/api/drop-db', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    res.json({
      success: true,
      message: 'Database dropped successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SafeHaven API Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB Database: safehaven_sas`);
  console.log(`🔗 Connection: ${MONGODB_URI}`);
  
  // Log blockchain status
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
