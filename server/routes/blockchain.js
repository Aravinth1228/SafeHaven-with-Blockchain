const express = require('express');
const router = express.Router();
const relayer = require('../blockchain/relayer');
const { Profile, Alert, DangerZone, UserLocation, Notification } = require('../models');

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
 * Blockchain Meta-Transaction Routes
 *
 * These routes handle ERC-2771 meta-transactions:
 * - Users sign messages with MetaMask
 * - Backend verifies signatures and submits transactions
 * - Admin wallet pays gas fees
 */

/**
 * GET /api/blockchain/nonce
 * Get current nonce for a wallet address
 */
router.get('/nonce', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      return res.status(400).json({ success: false, error: 'Wallet address required' });
    }

    const nonce = await relayer.getNonce(wallet);
    res.json({ success: true, nonce });
  } catch (error) {
    console.error('Error getting nonce:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/status
 * Check blockchain connection status
 */
router.get('/status', async (req, res) => {
  try {
    const isInitialized = relayer.isInitialized();
    const deploymentInfo = relayer.getDeploymentInfo();
    
    res.json({
      success: true,
      initialized: isInitialized,
      network: deploymentInfo?.network || 'Not configured',
      chainId: deploymentInfo?.chainId || null,
      contractAddress: deploymentInfo?.contracts?.TouristSafetyERC2771?.address || null,
      forwarderAddress: deploymentInfo?.contracts?.TrustedForwarder?.address || null,
      relayerAddress: relayer.wallet?.address || null
    });
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/is-registered/:wallet
 * Check if a wallet is registered on blockchain
 */
router.get('/is-registered/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const isRegistered = await relayer.isRegistered(wallet);
    const touristInfo = isRegistered ? await relayer.getTourist(wallet) : null;

    res.json({
      success: true,
      isRegistered,
      tourist: touristInfo
    });
  } catch (error) {
    console.error('Error checking registration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/tourist/:wallet
 * Get tourist info from blockchain
 */
router.get('/tourist/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    const tourist = await relayer.getTourist(wallet);
    
    if (!tourist) {
      return res.status(404).json({ success: false, error: 'Tourist not found' });
    }

    res.json({ success: true, data: tourist });
  } catch (error) {
    console.error('Error getting tourist info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/meta-tx
 * Submit a meta-transaction for processing
 * 
 * Body:
 * - action: 'register' | 'updateStatus' | 'updateLocation'
 * - wallet: User's wallet address
 * - signature: EIP-712 signature
 * - message: Signed message data
 */
router.post('/meta-tx', async (req, res) => {
  try {
    const { action, wallet, signature, message } = req.body;

    // Validate input
    if (!action || !wallet || !signature || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: action, wallet, signature, message' 
      });
    }

    // Check if blockchain is initialized
    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized. Please deploy contracts first.',
        blockchainEnabled: false
      });
    }

    let result;

    switch (action) {
      case 'register':
        result = await relayer.registerTourist(wallet, message, signature);
        
        // Also save to MongoDB for faster queries and additional data
        try {
          await Profile.findOneAndUpdate(
            { wallet_address: wallet },
            {
              wallet_address: wallet,
              tourist_id: result.touristId || message.touristId,
              username: message.username,
              email: message.email,
              phone: message.phone,
              dob: new Date(parseInt(message.dateOfBirth) * 1000).toISOString(),
              status: 'safe',
              updated_at: new Date()
            },
            { upsert: true, new: true }
          );
          console.log('✅ MongoDB profile created/updated for:', wallet);
        } catch (dbErr) {
          console.error('⚠️ Failed to save MongoDB profile:', dbErr.message);
          // Don't fail the request if MongoDB save fails
        }
        break;

      case 'updateStatus':
        result = await relayer.updateStatus(wallet, message, signature);

        // Also update MongoDB profile status
        try {
          const statusMap = { 0: 'safe', 1: 'alert', 2: 'danger' };
          
          // First try to find by wallet_address
          let profile = await Profile.findOne({ wallet_address: wallet });
          
          // If not found, try searching by tourist_id from blockchain
          if (!profile) {
            const touristInfo = await relayer.getTourist(wallet);
            if (touristInfo && touristInfo.touristId) {
              profile = await Profile.findOne({ tourist_id: touristInfo.touristId });
            }
          }
          
          if (profile) {
            await Profile.findByIdAndUpdate(profile._id, {
              status: statusMap[message.status] || 'safe',
              updated_at: new Date()
            });
            console.log('✅ MongoDB status updated for:', wallet, 'Tourist ID:', profile.tourist_id);
          } else {
            console.warn('⚠️ No MongoDB profile found for wallet:', wallet);
          }
        } catch (dbErr) {
          console.error('⚠️ Failed to update MongoDB status:', dbErr.message);
        }
        break;

      case 'updateLocation':
        result = await relayer.updateLocation(wallet, message, signature);
        
        // Also update MongoDB location
        try {
          const { UserLocation } = require('../models');
          const { ethers } = require('ethers');
          
          // Decode latitude and longitude from the encoded data
          const locationInterface = new ethers.Interface([
            "function updateLocation(int256 latitude, int256 longitude) external"
          ]);
          const decoded = locationInterface.decodeFunctionData('updateLocation', message.data);
          const lat = Number(decoded.latitude) / 1e6;
          const lng = Number(decoded.longitude) / 1e6;
          
          await UserLocation.findOneAndUpdate(
            { wallet_address: wallet },
            {
              wallet_address: wallet,
              lat,
              lng,
              status: 'safe',
              updated_at: new Date()
            },
            { upsert: true }
          );
          console.log('✅ MongoDB location updated for:', wallet, 'Lat:', lat, 'Lng:', lng);
        } catch (dbErr) {
          console.error('⚠️ Failed to update MongoDB location:', dbErr.message);
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Invalid action: ${action}. Valid actions: register, updateStatus, updateLocation`
        });
    }

    res.json({
      success: true,
      data: result,
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Meta-transaction error:', error);
    
    // Handle specific error types
    if (error.message.includes('Invalid signature')) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    if (error.message.includes('expired')) {
      return res.status(400).json({ success: false, error: 'Signature expired. Please try again.' });
    }
    if (error.message.includes('nonce')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('Already registered')) {
      return res.status(400).json({ success: false, error: 'Wallet already registered' });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/register-and-sync
 * Register on blockchain and sync with MongoDB
 * This is a convenience endpoint that handles both blockchain and DB registration
 */
router.post('/register-and-sync', async (req, res) => {
  try {
    const { 
      wallet, 
      signature, 
      message,
      user_id 
    } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({ 
        success: false, 
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Register on blockchain
    const blockchainResult = await relayer.registerTourist(wallet, message, signature);
    
    // Also save to MongoDB for faster queries and additional data
    const profile = await Profile.findOneAndUpdate(
      { wallet_address: wallet },
      {
        wallet_address: wallet,
        tourist_id: blockchainResult.touristId || message.touristId,
        username: message.username,
        email: message.email,
        phone: message.phone,
        dob: new Date(parseInt(message.dateOfBirth) * 1000).toISOString(),
        status: 'safe',
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        blockchain: blockchainResult,
        profile
      },
      blockchainEnabled: true
    });

  } catch (error) {
    console.error('Register and sync error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/deployment-info
 * Get contract deployment information
 */
router.get('/deployment-info', async (req, res) => {
  try {
    const deploymentInfo = relayer.getDeploymentInfo();

    if (!deploymentInfo) {
      return res.status(404).json({ success: false, error: 'Deployment info not found' });
    }

    res.json({ success: true, data: deploymentInfo });
  } catch (error) {
    console.error('Error getting deployment info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/danger-zone
 * Create danger zone on blockchain and sync to MongoDB
 */
router.post('/danger-zone', async (req, res) => {
  try {
    const { name, lat, lng, radius, level, created_by, signature, message } = req.body;

    if (!relayer.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain not initialized',
        blockchainEnabled: false
      });
    }

    // Create danger zone on blockchain via meta-transaction
    let blockchainResult;
    if (signature && message) {
      blockchainResult = await relayer.createDangerZone(created_by, message, signature);
    }

    // Save to MongoDB
    const zone = await DangerZone.create({ 
      name, 
      lat, 
      lng, 
      radius, 
      level, 
      created_by,
      blockchain_zone_id: blockchainResult?.zoneId,
      blockchain_tx_hash: blockchainResult?.txHash
    });

    // Check if any users are inside or near this new zone
    const users = await UserLocation.find();
    const notifications = [];
    const updatedUsers = [];

    for (const user of users) {
      const distance = calculateDistance(user.lat, user.lng, lat, lng);

      // If user is INSIDE the danger zone
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
      data: zone,
      blockchain: blockchainResult,
      notifications: notifications.length,
      emergencyUsers: updatedUsers.length,
      emergencyUsernames: updatedUsers
    });

  } catch (error) {
    console.error('Create danger zone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
