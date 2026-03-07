const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔐 Adding Admin to TouristSafetyERC2771...\n");

  // Contract address
  const TOURIST_SAFETY_ADDRESS = "0xa2FEcd68ebB27d53eF9224C06B81a427C2F303ce";

  // Get the deployer/owner account
  const [owner] = await ethers.getSigners();
  console.log("📝 Using account:", owner.address);

  // Check balance
  const balance = await ethers.provider.getBalance(owner.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Get the contract
  const TouristSafety = await ethers.getContractFactory("TouristSafetyERC2771");
  const touristSafety = TouristSafety.attach(TOURIST_SAFETY_ADDRESS);

  // Check current admin status
  const newAdminAddress = "0x548cb269df02005590cf48fb031dd697e52aa201"; // Your current wallet
  console.log("👤 Admin to add:", newAdminAddress);

  const isAdminBefore = await touristSafety.isAdmin(newAdminAddress);
  console.log("📋 Is admin before:", isAdminBefore);

  if (!isAdminBefore) {
    console.log("\n➕ Adding admin...");
    const tx = await touristSafety.addAdmin(newAdminAddress);
    console.log("⏳ Transaction sent:", tx.hash);
    await tx.wait();
    console.log("✅ Transaction confirmed!");

    const isAdminAfter = await touristSafety.isAdmin(newAdminAddress);
    console.log("📋 Is admin after:", isAdminAfter);
  } else {
    console.log("✅ Address is already an admin!");
  }

  // List all admins
  console.log("\n📋 All admins:");
  const admins = await touristSafety.getAdmins();
  admins.forEach((admin, index) => {
    console.log(`  ${index + 1}. ${admin}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
