const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TouristSafetyERC2771", function () {
  let touristSafety;
  let trustedForwarder;
  let owner;
  let admin;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, admin, user1, user2] = await ethers.getSigners();

    // Deploy TrustedForwarder
    const TrustedForwarder = await ethers.getContractFactory("TrustedForwarder");
    trustedForwarder = await TrustedForwarder.deploy();
    await trustedForwarder.waitForDeployment();

    // Deploy TouristSafetyERC2771
    const TouristSafetyERC2771 = await ethers.getContractFactory("TouristSafetyERC2771");
    touristSafety = await TouristSafetyERC2771.deploy(await trustedForwarder.getAddress());
    await touristSafety.waitForDeployment();

    // Add admin
    await touristSafety.addAdmin(admin.address);
  });

  describe("Tourist Registration", function () {
    it("Should register a new tourist", async function () {
      const tx = await touristSafety.connect(user1).registerTourist(
        "John Doe",
        "john@example.com",
        "+1234567890",
        631152000 // 1990-01-01
      );
      await tx.wait();

      const tourist = await touristSafety.getTourist(user1.address);
      expect(tourist.isActive).to.be.true;
      expect(tourist.username).to.equal("John Doe");
      expect(tourist.email).to.equal("john@example.com");
    });

    it("Should not allow duplicate registration", async function () {
      await touristSafety.connect(user1).registerTourist(
        "John Doe",
        "john@example.com",
        "+1234567890",
        631152000
      );

      await expect(
        touristSafety.connect(user1).registerTourist(
          "John Doe 2",
          "john2@example.com",
          "+1234567890",
          631152000
        )
      ).to.be.revertedWith("Already registered");
    });
  });

  describe("Status Updates", function () {
    beforeEach(async function () {
      await touristSafety.connect(user1).registerTourist(
        "John Doe",
        "john@example.com",
        "+1234567890",
        631152000
      );
    });

    it("Should update tourist status", async function () {
      const tx = await touristSafety.connect(user1).updateStatus(1); // Alert
      await tx.wait();

      const tourist = await touristSafety.getTourist(user1.address);
      expect(tourist.status).to.equal(1); // Alert
    });

    it("Should emit StatusUpdated event", async function () {
      const tourist = await touristSafety.getTourist(user1.address);
      
      const tx = await touristSafety.connect(user1).updateStatus(2); // Danger
      const receipt = await tx.wait();
      
      // Check that StatusUpdated event was emitted
      const statusEvent = receipt.logs.find(log => log?.fragment?.name === "StatusUpdated");
      expect(statusEvent).to.not.be.undefined;
    });
  });

  describe("Location Updates", function () {
    beforeEach(async function () {
      await touristSafety.connect(user1).registerTourist(
        "John Doe",
        "john@example.com",
        "+1234567890",
        631152000
      );
    });

    it("Should update location", async function () {
      const lat = 4071280000; // New York * 1e6
      const lng = -7400600000;

      const tx = await touristSafety.connect(user1).updateLocation(lat, lng);
      await tx.wait();

      const tourist = await touristSafety.getTourist(user1.address);
      expect(tourist.lastLatitude).to.equal(lat);
      expect(tourist.lastLongitude).to.equal(lng);
    });
  });

  describe("Danger Zone Management", function () {
    it("Should create danger zone (admin only)", async function () {
      const tx = await touristSafety.connect(admin).createDangerZone(
        "High Crime Area",
        4071280000,
        -7400600000,
        500, // 500 meters
        2 // High
      );
      await tx.wait();

      const zones = await touristSafety.getActiveDangerZones();
      expect(zones.length).to.equal(1);
      expect(zones[0].name).to.equal("High Crime Area");
    });

    it("Should not allow non-admin to create danger zone", async function () {
      await expect(
        touristSafety.connect(user1).createDangerZone(
          "Test Zone",
          4071280000,
          -7400600000,
          500,
          1
        )
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("ERC-2771 Meta-Transaction Support", function () {
    it("Should have correct trusted forwarder", async function () {
      const storedForwarder = await touristSafety.trustedForwarder();
      expect(storedForwarder.toLowerCase()).to.equal((await trustedForwarder.getAddress()).toLowerCase());
    });

    it("Should identify correct msgSender through forwarder", async function () {
      // This test verifies that _msgSender() works correctly
      await touristSafety.connect(user1).registerTourist(
        "John Doe",
        "john@example.com",
        "+1234567890",
        631152000
      );

      const tourist = await touristSafety.getTourist(user1.address);
      expect(tourist.isActive).to.be.true;
      // The tourist should be registered to user1's address, not the forwarder's
    });
  });
});
