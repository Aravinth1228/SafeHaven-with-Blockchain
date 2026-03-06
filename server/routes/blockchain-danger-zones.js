const express = require('express');
const router = express.Router();
const relayer = require('../blockchain/relayer');
const { Profile, Alert, UserLocation, Notification } = require('../models');
const { ethers } = require('ethers');

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
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

/**
 * Blockchain-Only Danger Zone Routes
 *
 * These routes manage danger zones stored ONLY on blockchain:
 * - GET /api/blockchain/danger-zones - Get all danger zones from blockchain
 * - POST /api/blockchain/danger-zones - Create danger zone on blockchain
 * - DELETE /api/blockchain/danger-zones/:index - Remove danger zone from blockchain
 * - GET /api/blockchain/danger-zones/active - Get active danger zones only
 */

/**
 * GET /api/blockchain/danger-zones
 * Get all danger zones from blockchain
 */
router.get('/', async (req, res) => {
  try {
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
    console.error('Error getting danger zones from blockchain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/danger-zones/active
 * Get only active danger zones from blockchain
 */
router.get('/active', async (req, res) => {
  try {
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Get active danger zones from blockchain
    const zones = await relayer.getActiveDangerZones();

    // Level enum mapping (0=Low, 1=Medium, 2=High, 3=Critical)
    const levelNames = ['Low', 'Medium', 'High', 'Critical'];

    // Format zones for frontend
    const formattedZones = zones.map((zone, index) => ({
      id: zone.zoneId || `zone-${index}`,
      blockchainIndex: index,
      zoneId: zone.zoneId,
      name: zone.name,
      lat: Number(zone.latitude) / 1e6,
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
    console.error('Error getting active danger zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/danger-zones
 * Create danger zone on blockchain (NO MongoDB storage)
 */
router.post('/', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by, signature, message } = req.body;

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

    // Create danger zone on blockchain via meta-transaction
    let blockchainResult;
    if (signature && message) {
      blockchainResult = await relayer.createDangerZone(created_by, message, signature);
    } else {
      // Direct creation (admin wallet signs)
      blockchainResult = await relayer.createDangerZoneDirect(
        created_by,
        name,
        latInt,
        lngInt,
        radius,
        levelEnum
      );
    }

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
      message: 'Danger zone created on blockchain only (not stored in MongoDB)'
    });

  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/blockchain/danger-zones/:index
 * Remove danger zone from blockchain (NO MongoDB deletion needed)
 */
router.delete('/:index', async (req, res) => {
  try {
    const { index } = req.params;
    const { admin_wallet } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Remove danger zone from blockchain
    const result = await relayer.removeDangerZone(admin_wallet, parseInt(index));

    res.json({
      success: true,
      data: {
        blockchainIndex: parseInt(index),
        removed: true
      },
      blockchain: {
        txHash: result?.txHash,
        blockNumber: result?.blockNumber
      },
      blockchainEnabled: true,
      message: 'Danger zone removed from blockchain only'
    });

  } catch (error) {
    console.error('Remove danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/danger-zones/count
 * Get total number of danger zones
 */
router.get('/count', async (req, res) => {
  try {
    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const count = await relayer.getDangerZoneCount();

    res.json({
      success: true,
      data: { count },
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Error getting danger zone count:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/danger-zones/:index
 * Get specific danger zone by index
 */
router.get('/:index', async (req, res) => {
  try {
    const { index } = req.params;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const zone = await relayer.getDangerZoneByIndex(parseInt(index));

    if (!zone || !zone.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Danger zone not found or inactive'
      });
    }

    const formattedZone = {
      id: zone.zoneId || `zone-${index}`,
      blockchainIndex: parseInt(index),
      zoneId: zone.zoneId,
      name: zone.name,
      lat: Number(zone.latitude) / 1e6,
      lng: Number(zone.longitude) / 1e6,
      radius: Number(zone.radius),
      level: zone.level,
      createdBy: zone.createdBy,
      createdAt: new Date(Number(zone.createdAt) * 1000),
      isActive: zone.isActive
    };

    res.json({
      success: true,
      data: formattedZone,
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Error getting danger zone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
