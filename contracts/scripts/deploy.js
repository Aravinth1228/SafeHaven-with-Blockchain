const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying SafeHeaven ERC-2771 Contracts...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. Deploy TrustedForwarder
  console.log("📦 Deploying TrustedForwarder contract...");
  const TrustedForwarder = await hre.ethers.getContractFactory("TrustedForwarder");
  const trustedForwarder = await TrustedForwarder.deploy();
  await trustedForwarder.waitForDeployment();
  const trustedForwarderAddress = await trustedForwarder.getAddress();
  console.log("✅ TrustedForwarder deployed to:", trustedForwarderAddress);

  // 2. Deploy TouristSafetyERC2771 with TrustedForwarder address
  console.log("\n📦 Deploying TouristSafetyERC2771 contract...");
  const TouristSafetyERC2771 = await hre.ethers.getContractFactory("TouristSafetyERC2771");
  const touristSafety = await TouristSafetyERC2771.deploy(trustedForwarderAddress);
  await touristSafety.waitForDeployment();
  const touristSafetyAddress = await touristSafety.getAddress();
  console.log("✅ TouristSafetyERC2771 deployed to:", touristSafetyAddress);

  // 3. Verify contracts are linked correctly
  console.log("\n🔗 Verifying contract linkage...");
  const storedForwarder = await touristSafety.trustedForwarder();
  console.log("✅ TouristSafety trusted forwarder:", storedForwarder);
  console.log("✅ Match:", storedForwarder.toLowerCase() === trustedForwarderAddress.toLowerCase());

  // 4. Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
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
    }
  };

  // Save to file
  const deploymentPath = path.join(__dirname, "deployment-info.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Also save to server directory for backend use
  const serverDeploymentPath = path.join(__dirname, "..", "..", "server", "blockchain-deployment.json");
  fs.writeFileSync(serverDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Backend deployment info saved to:", serverDeploymentPath);

  console.log("\n✅ Deployment complete!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Network: ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`TrustedForwarder: ${trustedForwarderAddress}`);
  console.log(`TouristSafetyERC2771: ${touristSafetyAddress}`);
  console.log("═══════════════════════════════════════════════════════════");

  return {
    trustedForwarderAddress,
    touristSafetyAddress,
    deployer
  };
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
