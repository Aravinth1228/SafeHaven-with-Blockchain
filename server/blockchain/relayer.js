const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Blockchain Relayer Service
 * 
 * This service handles ERC-2771 meta-transactions:
 * 1. Verifies user signatures
 * 2. Submits transactions to the blockchain using admin wallet (pays gas)
 * 3. Tracks nonces for each user
 */
class BlockchainRelayer {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.forwarderContract = null;
    this.deploymentInfo = null;
    this.contractAddress = null; // Store contract address separately (ethers v6)
    this.forwarderAddress = null; // Store forwarder address separately (ethers v6)
    this.nonces = new Map(); // In-memory nonce tracking
    this.initialized = false;
  }

  /**
   * Initialize the relayer with deployment info
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load deployment info
      const deploymentPath = path.join(__dirname, '..', 'blockchain-deployment.json');
      if (!fs.existsSync(deploymentPath)) {
        console.log('⚠️  Blockchain deployment info not found. Run contract deployment first.');
        return;
      }

      this.deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      console.log('📄 Loaded deployment info:', this.deploymentInfo.network);

      // Get RPC URL based on network
      let rpcUrl;
      if (this.deploymentInfo.network === 'localhost' || this.deploymentInfo.network === 'hardhat') {
        rpcUrl = 'http://127.0.0.1:8545';
      } else if (this.deploymentInfo.network === 'sepolia') {
        rpcUrl = process.env.SEPOLIA_RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
      } else if (this.deploymentInfo.network === 'mainnet') {
        rpcUrl = process.env.MAINNET_RPC_URL || `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Initialize admin wallet (relayer)
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not set in environment');
      }
      this.wallet = new ethers.Wallet(adminPrivateKey, this.provider);
      
      console.log('✅ Relayer wallet:', this.wallet.address);

      // Load contract ABI
      const abiPath = path.join(__dirname, '..', '..', 'contracts', 'artifacts', 'contracts', 'TouristSafetyERC2771.sol', 'TouristSafetyERC2771.json');
      if (!fs.existsSync(abiPath)) {
        throw new Error('Contract ABI not found. Run `npm run compile` in contracts folder.');
      }

      const contractArtifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
      
      // Initialize contract instance
      this.contractAddress = this.deploymentInfo.contracts.TouristSafetyERC2771.address;
      this.contract = new ethers.Contract(
        this.contractAddress,
        contractArtifact.abi,
        this.wallet
      );

      // Load forwarder ABI
      const forwarderAbiPath = path.join(__dirname, '..', '..', 'contracts', 'artifacts', 'contracts', 'TrustedForwarder.sol', 'TrustedForwarder.json');
      console.log('🔍 Looking for forwarder ABI at:', forwarderAbiPath);
      console.log('🔍 Forwarder ABI exists:', fs.existsSync(forwarderAbiPath));

      if (fs.existsSync(forwarderAbiPath)) {
        const forwarderArtifact = JSON.parse(fs.readFileSync(forwarderAbiPath, 'utf8'));
        this.forwarderAddress = this.deploymentInfo.contracts.TrustedForwarder.address;
        this.forwarderContract = new ethers.Contract(
          this.forwarderAddress,
          forwarderArtifact.abi,
          this.wallet
        );
        console.log('✅ Forwarder contract loaded:', this.forwarderAddress);
      } else {
        console.error('❌ Forwarder ABI not found at:', forwarderAbiPath);
      }

      // Load nonces from file if exists
      const noncesPath = path.join(__dirname, 'nonces.json');
      if (fs.existsSync(noncesPath)) {
        const savedNonces = JSON.parse(fs.readFileSync(noncesPath, 'utf8'));
        Object.entries(savedNonces).forEach(([address, nonce]) => {
          this.nonces.set(address.toLowerCase(), nonce);
        });
      }

      this.initialized = true;
      console.log('✅ Blockchain Relayer initialized');
      console.log('📝 Contract:', this.contractAddress);
      console.log('🔗 Forwarder:', this.forwarderAddress);

    } catch (error) {
      console.error('❌ Failed to initialize blockchain relayer:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Get current nonce for a user (from on-chain forwarder)
   */
  async getNonce(walletAddress) {
    if (!this.forwarderContract) {
      // Fallback to local nonce if forwarder not available
      const normalizedAddress = walletAddress.toLowerCase();
      if (!this.nonces.has(normalizedAddress)) {
        this.nonces.set(normalizedAddress, 0);
      }
      return this.nonces.get(normalizedAddress);
    }

    // Get actual on-chain nonce from forwarder contract
    const normalizedAddress = walletAddress.toLowerCase();
    const onChainNonce = await this.forwarderContract.nonces(normalizedAddress);
    const nonceNum = Number(onChainNonce);
    console.log(`🔢 getNonce for ${normalizedAddress}: on-chain=${nonceNum}`);
    return nonceNum;
  }

  /**
   * Get local nonce (for backwards compatibility)
   */
  getLocalNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    if (!this.nonces.has(normalizedAddress)) {
      this.nonces.set(normalizedAddress, 0);
    }
    return this.nonces.get(normalizedAddress);
  }

  /**
   * Increment nonce for a user
   */
  incrementNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const currentNonce = this.getLocalNonce(normalizedAddress);
    this.nonces.set(normalizedAddress, currentNonce + 1);
    this.saveNonces();
    return this.nonces.get(normalizedAddress);
  }

  /**
   * Save nonces to file
   */
  saveNonces() {
    try {
      const noncesPath = path.join(__dirname, 'nonces.json');
      const noncesObj = {};
      this.nonces.forEach((nonce, address) => {
        noncesObj[address] = nonce;
      });
      fs.writeFileSync(noncesPath, JSON.stringify(noncesObj, null, 2));
    } catch (error) {
      console.error('Failed to save nonces:', error);
    }
  }

  /**
   * Verify EIP-712 signature
   */
  async verifySignature(walletAddress, domain, types, value, signature) {
    try {
      const signerAddress = ethers.verifyTypedData(domain, types, value, signature);
      return signerAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get EIP-712 domain separator (for Forwarder contract)
   * MUST match the TrustedForwarder constructor: ERC2771Forwarder("SafeHeaven Trusted Forwarder")
   */
  getDomainSeparator() {
    return {
      name: 'SafeHeaven Trusted Forwarder',  // MUST match ERC2771Forwarder constructor
      version: '1',                          // OpenZeppelin EIP712 uses version '1'
      chainId: this.deploymentInfo.chainId,
      verifyingContract: this.deploymentInfo.contracts.TrustedForwarder.address
    };
  }

  /**
   * Process register tourist meta-transaction
   */
  async registerTourist(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    console.log('📝 Register tourist request:', {
      wallet: walletAddress,
      from: forwardRequest.from,
      to: forwardRequest.to,
      nonce: forwardRequest.nonce,
      deadline: forwardRequest.deadline
    });

    // Check deadline
    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    console.log('⏰ Checking deadline:', {
      deadline: Number(deadline),
      currentBlock: currentBlock.timestamp,
      expired: deadline < currentBlock.timestamp
    });

    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    // Check nonce (forwarder will also verify this)
    const expectedNonce = await this.getNonce(walletAddress);
    console.log('🔢 Checking nonce:', {
      expected: expectedNonce,
      received: Number(forwardRequest.nonce)
    });

    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      console.log('📦 Forward request data:', forwardRequest.data);
      console.log('📝 Forwarder contract object:', this.forwarderContract ? 'exists' : 'NULL/UNDEFINED');
      console.log('📝 Forwarder address:', this.forwarderAddress);
      console.log('📝 Contract address:', this.contractAddress);
      console.log('💰 Relayer balance:', await this.provider.getBalance(this.wallet.address));

      // Verify the forwarder contract is loaded
      if (!this.forwarderContract) {
        throw new Error('Forwarder contract not loaded! Check initialization.');
      }

      // Verify the target contract trusts the forwarder BEFORE executing
      try {
        console.log('🔐 Checking if target trusts forwarder...');
        console.log('   Target:', this.contractAddress);
        console.log('   Forwarder:', this.forwarderAddress);
        const isTrusted = await this.contract.isTrustedForwarder(this.forwarderAddress);
        console.log('🔐 Target contract trusts forwarder:', isTrusted);
        if (!isTrusted) {
          throw new Error(`Target contract ${this.contractAddress} does not trust forwarder ${this.forwarderAddress}`);
        }
      } catch (trustErr) {
        console.error('❌ Trust verification failed:', trustErr.message);
        throw trustErr;
      }

      // Use forwarder to execute the transaction
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: 0,
        gas: 300000,
        nonce: expectedNonce,
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('🔐 Forward request:', request);

      // Execute through forwarder
      console.log('📤 Executing forwarder transaction...');
      
      // Try to estimate gas first to get a better error message
      try {
        const gasEstimate = await this.forwarderContract.execute.estimateGas(request);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasErr) {
        console.error('❌ Gas estimation failed:', gasErr.message);
        console.error('This means the transaction would revert. Check:');
        console.error('  1. Nonce matches on-chain nonce');
        console.error('  2. Signature is valid (correct domain separator)');
        console.error('  3. Target contract trusts the forwarder');
        console.error('  4. Deadline has not expired');
        throw gasErr;
      }
      
      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash, 'Block:', receipt.blockNumber);

      // Increment nonce
      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        touristId: this.extractTouristIdFromReceipt(receipt)
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      console.error('Error details:', {
        reason: error.reason,
        code: error.code,
        error: error.error
      });
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  /**
   * Process update status meta-transaction
   */
  async updateStatus(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    console.log('📝 Update status request:', {
      wallet: walletAddress,
      from: forwardRequest.from,
      to: forwardRequest.to,
      nonce: forwardRequest.nonce,
      deadline: forwardRequest.deadline
    });

    // Check if user is registered on blockchain
    const isRegistered = await this.isRegistered(walletAddress);
    if (!isRegistered) {
      throw new Error('User not registered on blockchain. Please register first.');
    }
    console.log('✅ User is registered:', walletAddress);

    // Check deadline
    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    console.log('⏰ Checking deadline:', {
      deadline: Number(deadline),
      currentBlock: currentBlock.timestamp,
      expired: deadline < currentBlock.timestamp
    });
    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    // Check nonce (forwarder will also verify this)
    const expectedNonce = await this.getNonce(walletAddress);
    console.log('🔢 Checking nonce:', {
      expected: expectedNonce,
      received: Number(forwardRequest.nonce)
    });
    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // Use forwarder to execute the transaction
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: 0,
        gas: 150000,  // Increased gas for status update
        nonce: expectedNonce,
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('📤 Executing update status via forwarder...');
      
      // Try to estimate gas first
      try {
        const gasEstimate = await this.forwarderContract.execute.estimateGas(request);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasErr) {
        console.error('❌ Gas estimation failed:', gasErr.message);
        throw gasErr;
      }

      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Update status tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('❌ Update status transaction failed:', error);
      console.error('Error details:', {
        reason: error.reason,
        code: error.code,
        error: error.error?.message
      });
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  /**
   * Process update location meta-transaction
   */
  async updateLocation(walletAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    // Check deadline
    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    // Check nonce (forwarder will also verify this)
    const expectedNonce = await this.getNonce(walletAddress);
    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // Use forwarder to execute the transaction
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: 0,
        gas: 100000,
        nonce: expectedNonce,
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Update location tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);

      this.incrementNonce(walletAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  /**
   * Check if user is registered
   */
  async isRegistered(walletAddress) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const result = await this.contract.isRegistered(walletAddress);
      return result;
    } catch (error) {
      console.error('Error checking registration:', error);
      return false;
    }
  }

  /**
   * Get tourist info
   */
  async getTourist(walletAddress) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const tourist = await this.contract.getTourist(walletAddress);
      if (!tourist.isActive) return null;
      
      return {
        touristId: tourist.touristId,
        username: tourist.username,
        email: tourist.email,
        phone: tourist.phone,
        dateOfBirth: tourist.dateOfBirth.toString(),
        status: tourist.status,
        registeredAt: tourist.registeredAt.toString(),
        isActive: tourist.isActive,
        lastLatitude: tourist.lastLatitude.toString(),
        lastLongitude: tourist.lastLongitude.toString(),
        lastLocationUpdate: tourist.lastLocationUpdate.toString()
      };
    } catch (error) {
      console.error('Error getting tourist info:', error);
      return null;
    }
  }

  /**
   * Extract tourist ID from transaction receipt
   */
  extractTouristIdFromReceipt(receipt) {
    try {
      const contractInterface = this.contract.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog(log);
          if (parsed && parsed.name === 'TouristRegistered') {
            return parsed.args.touristId;
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.error('Error extracting tourist ID:', error);
    }
    return null;
  }

  /**
   * Get deployment info
   */
  getDeploymentInfo() {
    return this.deploymentInfo;
  }

  /**
   * Check if relayer is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Process create danger zone meta-transaction
   */
  async createDangerZone(adminAddress, forwardRequest, signature) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    // Check deadline
    const deadline = BigInt(forwardRequest.deadline);
    const currentBlock = await this.provider.getBlock('latest');
    if (deadline < currentBlock.timestamp) {
      throw new Error('Signature expired');
    }

    // Check nonce
    const expectedNonce = await this.getNonce(adminAddress);
    if (BigInt(forwardRequest.nonce) !== BigInt(expectedNonce)) {
      throw new Error(`Invalid nonce. Expected ${expectedNonce}, got ${forwardRequest.nonce}`);
    }

    try {
      // Use forwarder to execute the transaction
      const request = {
        from: forwardRequest.from,
        to: forwardRequest.to,
        value: 0,
        gas: 300000,
        nonce: expectedNonce,
        deadline: Number(deadline),
        data: forwardRequest.data,
        signature: signature
      };

      console.log('📤 Creating danger zone on blockchain...');
      const tx = await this.forwarderContract.execute(request);
      console.log('📝 Danger zone tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Danger zone transaction confirmed:', receipt.hash);

      this.incrementNonce(adminAddress);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        zoneId: this.extractZoneIdFromReceipt(receipt)
      };
    } catch (error) {
      console.error('Danger zone transaction failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  /**
   * Extract zone ID from transaction receipt
   */
  extractZoneIdFromReceipt(receipt) {
    try {
      const contractInterface = this.contract.interface;
      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog(log);
          if (parsed && parsed.name === 'DangerZoneCreated') {
            return parsed.args.zoneId;
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.error('Error extracting zone ID:', error);
    }
    return null;
  }

  /**
   * Get all danger zones from blockchain
   */
  async getAllDangerZones() {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const zones = await this.contract.getAllDangerZones();
      return zones.map(zone => ({
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(), // Convert BigInt to string
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      }));
    } catch (error) {
      console.error('Error getting all danger zones:', error);
      throw error;
    }
  }

  /**
   * Get active danger zones from blockchain
   */
  async getActiveDangerZones() {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const zones = await this.contract.getActiveDangerZones();
      return zones.map(zone => ({
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(), // Convert BigInt to string
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      }));
    } catch (error) {
      console.error('Error getting active danger zones:', error);
      throw error;
    }
  }

  /**
   * Get danger zone count
   */
  async getDangerZoneCount() {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const zones = await this.contract.getAllDangerZones();
      return zones.length;
    } catch (error) {
      console.error('Error getting danger zone count:', error);
      throw error;
    }
  }

  /**
   * Get danger zone by index
   */
  async getDangerZoneByIndex(index) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      const zone = await this.contract.dangerZones(index);
      if (!zone.isActive) {
        return null;
      }
      return {
        zoneId: zone.zoneId,
        name: zone.name,
        latitude: zone.latitude.toString(),
        longitude: zone.longitude.toString(),
        radius: zone.radius.toString(),
        level: zone.level.toString(), // Convert BigInt to string
        createdBy: zone.createdBy,
        createdAt: zone.createdAt.toString(),
        isActive: zone.isActive
      };
    } catch (error) {
      console.error('Error getting danger zone by index:', error);
      return null;
    }
  }

  /**
   * Create danger zone directly (admin wallet signs, no meta-transaction)
   */
  async createDangerZoneDirect(adminAddress, name, latitude, longitude, radius, level) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      console.log('📤 Creating danger zone directly on blockchain...');
      console.log('   Name:', name);
      console.log('   Lat:', latitude, 'Lng:', longitude);
      console.log('   Radius:', radius, 'Level:', level);

      // Call contract function directly
      const tx = await this.contract.createDangerZone(name, latitude, longitude, radius, level);
      console.log('📝 Danger zone tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Danger zone transaction confirmed:', receipt.hash);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        zoneId: this.extractZoneIdFromReceipt(receipt),
        zoneIndex: receipt.logs.length // Approximate index
      };
    } catch (error) {
      console.error('Danger zone direct creation failed:', error);
      throw new Error(`Transaction failed: ${error.reason || error.message}`);
    }
  }

  /**
   * Get the relayer wallet address
   */
  getRelayerAddress() {
    return this.wallet ? this.wallet.address : null;
  }

  /**
   * Remove danger zone from blockchain
   */
  async removeDangerZone(adminAddress, zoneIndex) {
    if (!this.initialized) {
      throw new Error('Blockchain relayer not initialized');
    }

    try {
      console.log('📤 Removing danger zone from blockchain (index:', zoneIndex, ')');
      console.log('Admin address:', adminAddress);

      // First check if the zone exists and is active
      try {
        const zone = await this.contract.dangerZones(zoneIndex);
        console.log('Zone info:', {
          zoneId: zone.zoneId,
          name: zone.name,
          isActive: zone.isActive
        });

        if (!zone.isActive) {
          throw new Error(`Zone at index ${zoneIndex} is already inactive`);
        }
      } catch (checkErr) {
        if (checkErr.code === 'CALL_EXCEPTION' || checkErr.reason === 'execution reverted') {
          throw new Error(`Invalid zone index: ${zoneIndex}. Zone may not exist.`);
        }
        throw checkErr;
      }

      // Call contract function directly
      const tx = await this.contract.removeDangerZone(zoneIndex);
      console.log('📝 Remove danger zone tx:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Danger zone removal confirmed:', receipt.hash);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Danger zone removal failed:', error);
      if (error.reason) {
        throw new Error(`Contract reverted: ${error.reason}`);
      }
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}

// Export singleton instance
const relayer = new BlockchainRelayer();
module.exports = relayer;
