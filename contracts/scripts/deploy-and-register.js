const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SafeHeaven ERC-2771 Contracts & Registering Test User...\n");

  // Test user details
  const TEST_USER_PRIVATE_KEY = "98dd5d5ca2f674905eb8233a0feda2f18ae19cd1a7a1afe5b2e5b925cb35dbf6";
  const TEST_USER_ADDRESS = "0x1e6d7be40C13417BC96a12A7e38d5662d31aB034";
  
  console.log("👤 Test User Address:", TEST_USER_ADDRESS);
  console.log("📝 Using Relayer Account (pays gas for meta-transactions)\n");

  // Get the deployer/relayer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("🔧 Deployer/Relayer Account:", deployer.address);

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ============================================
  // STEP 1: Deploy TrustedForwarder
  // ============================================
  console.log("📦 Step 1: Deploying TrustedForwarder contract...");
  const TrustedForwarder = await hre.ethers.getContractFactory("TrustedForwarder");
  const trustedForwarder = await TrustedForwarder.deploy();
  await trustedForwarder.waitForDeployment();
  const trustedForwarderAddress = await trustedForwarder.getAddress();
  console.log("✅ TrustedForwarder deployed to:", trustedForwarderAddress);

  // ============================================
  // STEP 2: Deploy TouristSafetyERC2771
  // ============================================
  console.log("\n📦 Step 2: Deploying TouristSafetyERC2771 contract...");
  const TouristSafetyERC2771 = await hre.ethers.getContractFactory("TouristSafetyERC2771");
  const touristSafety = await TouristSafetyERC2771.deploy(trustedForwarderAddress);
  await touristSafety.waitForDeployment();
  const touristSafetyAddress = await touristSafety.getAddress();
  console.log("✅ TouristSafetyERC2771 deployed to:", touristSafetyAddress);

  // ============================================
  // STEP 3: Verify contracts are linked
  // ============================================
  console.log("\n🔗 Step 3: Verifying contract linkage...");
  const storedForwarder = await touristSafety.trustedForwarder();
  console.log("✅ TouristSafety trusted forwarder:", storedForwarder);
  console.log("✅ Match:", storedForwarder.toLowerCase() === trustedForwarderAddress.toLowerCase());

  // ============================================
  // STEP 4: Add test user as admin (optional)
  // ============================================
  console.log("\n📦 Step 4: Adding test user as admin...");
  const isAdmin = await touristSafety.isAdmin(TEST_USER_ADDRESS);
  if (!isAdmin) {
    const txAddAdmin = await touristSafety.addAdmin(TEST_USER_ADDRESS);
    await txAddAdmin.wait();
    console.log("✅ Test user added as admin");
  } else {
    console.log("ℹ️  Test user is already an admin (skipping)");
  }

  // ============================================
  // STEP 5: Register test user using ERC-2771 meta-transaction
  // ============================================
  console.log("\n📦 Step 5: Registering test user via ERC-2771 meta-transaction...");
  console.log("   (Relayer pays gas, user just signs the message)\n");

  // Get the test user signer
  const testUserSigner = new ethers.Wallet(TEST_USER_PRIVATE_KEY, hre.ethers.provider);
  console.log("   Test User Signer:", testUserSigner.address);

  // Get the forwarder contract instance
  const forwarderContract = await ethers.getContractAt(
    "TrustedForwarder",
    trustedForwarderAddress
  );

  // Get the main contract instance with test user signer
  const touristSafetyWithTestUser = await ethers.getContractAt(
    "TouristSafetyERC2771",
    touristSafetyAddress,
    testUserSigner
  );

  // Prepare the registerTourist call data
  const registerData = touristSafety.interface.encodeFunctionData("registerTourist", [
    "Test User",                              // username
    "testuser @safehaven.com",               // email
    "+1234567890",                           // phone
    Math.floor(Date.now() / 1000) - 800000000 // dateOfBirth (approx 25 years ago)
  ]);

  // Get nonce for the test user
  const nonce = await forwarderContract.nonces(testUserSigner.address);
  console.log("   Nonce:", nonce);

  // Get chain ID
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  console.log("   Chain ID:", chainId);

  // Create the domain separator (must match EIP712 domain in ERC2771Forwarder)
  const domain = {
    name: "ERC2771Forwarder",
    version: "1",
    chainId: chainId,
    verifyingContract: trustedForwarderAddress
  };

  // Create the types for EIP-712 (matching ERC2771Forwarder.ForwardRequest struct)
  // Note: ERC2771Forwarder uses nonce internally, we don't include it in the typed data
  const types = {
    ForwardRequest: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "gas", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint48" },
      { name: "data", type: "bytes" },
    ]
  };

  // Estimate gas for the transaction
  const gasEstimate = await hre.ethers.provider.estimateGas({
    from: deployer.address,
    to: touristSafetyAddress,
    data: registerData
  });
  const gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer
  console.log("   Gas Estimate:", gasLimit.toString());

  // Set deadline (1 hour from now)
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  console.log("   Deadline:", new Date(deadline * 1000).toISOString());

  // Create the forward request
  const forwardRequest = {
    from: testUserSigner.address,
    to: touristSafetyAddress,
    value: 0,
    gas: gasLimit,
    nonce: nonce,
    deadline: deadline,
    data: registerData
  };

  console.log("\n   📝 Signing EIP-712 message with test user account...");
  
  // Sign the typed data
  const signature = await testUserSigner.signTypedData(domain, types, forwardRequest);
  console.log("   ✅ Signature created:", signature.slice(0, 42) + "...");

  // Verify the signature
  console.log("\n   🔍 Verifying signature...");
  const signerFromSig = ethers.verifyTypedData(domain, types, forwardRequest, signature);
  console.log("   Recovered signer:", signerFromSig);
  console.log("   ✅ Signature valid:", signerFromSig.toLowerCase() === testUserSigner.address.toLowerCase());

  // Create the ForwardRequestData struct for execute/verify (includes signature)
  const forwardRequestData = {
    from: testUserSigner.address,
    to: touristSafetyAddress,
    value: 0,
    gas: gasLimit,
    deadline: deadline,
    data: registerData,
    signature: signature
  };

  // Check if forwarder can verify the request
  console.log("\n   🔍 Checking if forwarder can verify the request...");
  const isValid = await forwarderContract.verify(forwardRequestData);
  console.log("   ✅ Forwarder verification:", isValid);

  // Execute the meta-transaction (relayer pays gas)
  console.log("\n   💸 Executing meta-transaction (relayer pays gas)...");
  const executeTx = await forwarderContract.execute(forwardRequestData);
  console.log("   📝 Transaction hash:", executeTx.hash);
  
  const executeReceipt = await executeTx.wait();
  console.log("   ✅ Transaction confirmed!");
  console.log("   Gas used:", executeReceipt.gasUsed.toString());

  // Check if tourist was registered
  console.log("\n   🔍 Checking if test user is registered...");
  const isRegistered = await touristSafety.isRegistered(TEST_USER_ADDRESS);
  console.log("   ✅ Is registered:", isRegistered);

  if (isRegistered) {
    const touristInfo = await touristSafety.getTourist(TEST_USER_ADDRESS);
    console.log("\n   📋 Test User Information:");
    console.log("      Tourist ID:", touristInfo.touristId);
    console.log("      Username:", touristInfo.username);
    console.log("      Email:", touristInfo.email);
    console.log("      Status:", touristInfo.status);
    console.log("      Active:", touristInfo.isActive);
  }

  // ============================================
  // STEP 6: Save deployment info
  // ============================================
  console.log("\n💾 Step 6: Saving deployment info...");

  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || await hre.ethers.provider.getNetwork().then(n => n.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    relayer: deployer.address,
    testUser: TEST_USER_ADDRESS,
    contracts: {
      TrustedForwarder: {
        address: trustedForwarderAddress,
        abiPath: "./artifacts/contracts/TrustedForwarder.sol/TrustedForwarder.json"
      },
      TouristSafetyERC2771: {
        address: touristSafetyAddress,
        abiPath: "./artifacts/contracts/TouristSafetyERC2771.sol/TouristSafetyERC2771.json",
        trustedForwarder: trustedForwarderAddress
      }
    },
    testUserRegistration: {
      address: TEST_USER_ADDRESS,
      registered: isRegistered,
      touristId: isRegistered ? (await touristSafety.getTourist(TEST_USER_ADDRESS)).touristId : null
    }
  };

  // Save to contracts directory
  const deploymentPath = path.join(__dirname, "deployment-info.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("   ✅ Deployment info saved to:", deploymentPath);

  // Save to server directory for backend use
  const serverDeploymentPath = path.join(__dirname, "..", "..", "server", "blockchain-deployment.json");
  try {
    fs.writeFileSync(serverDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("   ✅ Backend deployment info saved to:", serverDeploymentPath);
  } catch (err) {
    console.log("   ⚠️  Could not save to server directory:", err.message);
  }

  // Update .env file
  const envPath = path.join(__dirname, "..", "..", ".env");
  const envContent = `# Frontend Environment Variables

# Node.js Backend API URL
VITE_API_BASE_URL=http://localhost:3000/api

# Blockchain Contract Addresses (newly deployed ERC-2771)
VITE_CONTRACT_ADDRESS=${touristSafetyAddress}
VITE_FORWARDER_ADDRESS=${trustedForwarderAddress}

# Blockchain Network
VITE_CHAIN_ID=${deploymentInfo.chainId}

# WalletConnect Project ID
# Get a free project ID at https://cloud.walletconnect.com
# Without a valid ID, WalletConnect features may not work properly
VITE_WALLETCONNECT_PROJECT_ID=78ab89658d43d82211779071b2fc1ee9

# Test User (for development)
TEST_USER_ADDRESS=${TEST_USER_ADDRESS}
TEST_USER_PRIVATE_KEY=${TEST_USER_PRIVATE_KEY}

# Relayer Account (pays gas for meta-transactions)
RELAYER_ADDRESS=${deployer.address}
`;
  fs.writeFileSync(envPath, envContent);
  console.log("   ✅ .env file updated with new contract addresses");

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log("\n✅ Deployment & Registration complete!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📋 DEPLOYMENT & REGISTRATION SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name} (Chain ID: ${deploymentInfo.chainId})`);
  console.log(`Deployer/Relayer: ${deployer.address}`);
  console.log(`Test User: ${TEST_USER_ADDRESS}`);
  console.log(`TrustedForwarder: ${trustedForwarderAddress}`);
  console.log(`TouristSafetyERC2771: ${touristSafetyAddress}`);
  console.log(`Test User Registered: ${isRegistered}`);
  if (isRegistered) {
    console.log(`Test User Tourist ID: ${(await touristSafety.getTourist(TEST_USER_ADDRESS)).touristId}`);
  }
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n💡 How ERC-2771 Meta-Transactions Work:");
  console.log("   1. User signs message with MetaMask (NO GAS FEE)");
  console.log("   2. Relayer (backend) submits transaction via Forwarder");
  console.log("   3. Forwarder verifies signature and executes the call");
  console.log("   4. Contract uses _msgSender() to get the real user address");
  console.log("   5. Relayer pays the gas fee, not the user!");
  console.log("═══════════════════════════════════════════════════════════\n");

  return {
    trustedForwarderAddress,
    touristSafetyAddress,
    testUser: TEST_USER_ADDRESS,
    isRegistered,
    deployer
  };
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
