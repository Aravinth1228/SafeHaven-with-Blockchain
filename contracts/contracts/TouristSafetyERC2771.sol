// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title TouristSafetyERC2771
 * @author Tourist Safety System
 * @notice ERC-2771 compatible smart contract for managing tourist identity, safety status, and emergency alerts
 * @dev This contract uses ERC-2771 for gasless meta-transactions
 *      Users sign messages with MetaMask (no gas fee), backend relayer submits transactions
 *      The contract can identify the real user via _msgSender() instead of msg.sender
 *      
 * How it works:
 * 1. User signs EIP-712 message with MetaMask (NO GAS FEE)
 * 2. Backend relayer submits transaction via ERC2771Forwarder.execute()
 * 3. Forwarder verifies signature and executes the call
 * 4. Contract uses _msgSender() to get the real user address
 */
contract TouristSafetyERC2771 is ERC2771Context {

    // ============ Enums ============

    enum SafetyStatus { Safe, Alert, Danger }
    enum ZoneLevel { Low, Medium, High, Critical }

    // ============ Structs ============

    struct Tourist {
        string touristId;
        string username;
        string email;
        string phone;
        uint256 dateOfBirth;
        SafetyStatus status;
        uint256 registeredAt;
        bool isActive;
        int256 lastLatitude;  // Stored as lat * 1e6 for precision
        int256 lastLongitude; // Stored as lng * 1e6 for precision
        uint256 lastLocationUpdate;
    }

    struct DangerZone {
        string zoneId;
        string name;
        int256 latitude;
        int256 longitude;
        uint256 radius; // in meters
        ZoneLevel level;
        address createdBy;
        uint256 createdAt;
        bool isActive;
    }

    struct EmergencyAlert {
        string alertId;
        address tourist;
        string touristId;
        SafetyStatus status;
        int256 latitude;
        int256 longitude;
        string zoneName;
        ZoneLevel zoneLevel;
        uint256 timestamp;
        bool isDismissed;
    }

    // ============ State Variables ============

    address public owner;
    address[] public admins;
    mapping(address => bool) public isAdmin;

    mapping(address => Tourist) public tourists;
    mapping(string => address) public touristIdToAddress;
    address[] public registeredTourists;

    DangerZone[] public dangerZones;
    mapping(string => uint256) public zoneIdToIndex;

    EmergencyAlert[] public alerts;
    uint256 public alertCount;

    uint256 private touristCounter;
    uint256 private zoneCounter;
    uint256 private alertCounter;

    // ============ Events ============

    event TouristRegistered(
        address indexed wallet,
        string touristId,
        string username,
        uint256 timestamp
    );

    event TouristDeleted(
        address indexed wallet,
        string touristId,
        uint256 timestamp
    );

    event StatusUpdated(
        address indexed tourist,
        string touristId,
        SafetyStatus oldStatus,
        SafetyStatus newStatus,
        uint256 timestamp
    );

    event LocationUpdated(
        address indexed tourist,
        string touristId,
        int256 latitude,
        int256 longitude,
        uint256 timestamp
    );

    event DangerZoneCreated(
        string zoneId,
        string name,
        int256 latitude,
        int256 longitude,
        uint256 radius,
        ZoneLevel level,
        address createdBy
    );

    event DangerZoneUpdated(
        string zoneId,
        string name,
        uint256 radius,
        ZoneLevel level
    );

    event DangerZoneRemoved(string zoneId, address removedBy);

    event EmergencyAlertCreated(
        string alertId,
        address indexed tourist,
        string touristId,
        SafetyStatus status,
        uint256 timestamp
    );

    event AlertDismissed(string alertId, address dismissedBy);

    event AdminAdded(address indexed admin, address addedBy);
    event AdminRemoved(address indexed admin, address removedBy);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(_msgSender() == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAdmin() {
        require(isAdmin[_msgSender()] || _msgSender() == owner, "Only admin can perform this action");
        _;
    }

    modifier onlyRegisteredTourist() {
        require(tourists[_msgSender()].isActive, "Tourist not registered");
        _;
    }

    modifier touristExists(address _tourist) {
        require(tourists[_tourist].isActive, "Tourist does not exist");
        _;
    }

    // ============ Constructor ============

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        owner = msg.sender;
        isAdmin[msg.sender] = true;
        admins.push(msg.sender);
    }

    // ============ Admin Management ============

    /**
     * @notice Add a new admin
     * @param _admin Address to grant admin privileges
     */
    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid address");
        require(!isAdmin[_admin], "Already an admin");

        isAdmin[_admin] = true;
        admins.push(_admin);

        emit AdminAdded(_admin, msg.sender);
    }

    /**
     * @notice Remove an admin
     * @param _admin Address to revoke admin privileges
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(_admin != owner, "Cannot remove owner");
        require(isAdmin[_admin], "Not an admin");

        isAdmin[_admin] = false;

        // Remove from admins array
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        emit AdminRemoved(_admin, msg.sender);
    }

    // ============ Tourist Registration ============

    /**
     * @notice Register a new tourist (direct transaction - pays gas)
     * @param _username Tourist's display name
     * @param _email Tourist's email address
     * @param _phone Tourist's phone number
     * @param _dateOfBirth Tourist's date of birth (Unix timestamp)
     */
    function registerTourist(
        string calldata _username,
        string calldata _email,
        string calldata _phone,
        uint256 _dateOfBirth
    ) external returns (string memory) {
        require(!tourists[_msgSender()].isActive, "Already registered");
        require(bytes(_username).length > 0, "Username required");
        require(bytes(_email).length > 0, "Email required");

        touristCounter++;
        string memory touristId = _generateTouristId();

        tourists[_msgSender()] = Tourist({
            touristId: touristId,
            username: _username,
            email: _email,
            phone: _phone,
            dateOfBirth: _dateOfBirth,
            status: SafetyStatus.Safe,
            registeredAt: block.timestamp,
            isActive: true,
            lastLatitude: 0,
            lastLongitude: 0,
            lastLocationUpdate: 0
        });

        touristIdToAddress[touristId] = _msgSender();
        registeredTourists.push(_msgSender());

        emit TouristRegistered(_msgSender(), touristId, _username, block.timestamp);

        return touristId;
    }

    /**
     * @notice Delete a tourist (admin only)
     * @param _tourist Wallet address of the tourist to delete
     */
    function deleteTourist(address _tourist) external onlyAdmin {
        require(tourists[_tourist].isActive, "Tourist not registered");
        
        // Get tourist data before deletion
        Tourist memory tourist = tourists[_tourist];
        
        // Mark as inactive (soft delete)
        tourists[_tourist].isActive = false;
        
        // Remove from registeredTourists array
        for (uint256 i = 0; i < registeredTourists.length; i++) {
            if (registeredTourists[i] == _tourist) {
                registeredTourists[i] = registeredTourists[registeredTourists.length - 1];
                registeredTourists.pop();
                break;
            }
        }
        
        // Clear touristId mapping
        delete touristIdToAddress[tourist.touristId];
        
        emit TouristDeleted(_tourist, tourist.touristId, block.timestamp);
    }

    /**
     * @notice Generate a unique tourist ID
     */
    function _generateTouristId() private view returns (string memory) {
        bytes memory prefix = "TID-";
        bytes memory timestamp = _toHexString(block.timestamp);
        bytes memory random = _toHexString(uint256(keccak256(abi.encodePacked(block.timestamp, _msgSender(), touristCounter))));

        return string(abi.encodePacked(prefix, timestamp, "-", random));
    }

    /**
     * @notice Convert uint to hex string
     */
    function _toHexString(uint256 value) private pure returns (bytes memory) {
        if (value == 0) return "0";

        bytes memory buffer = new bytes(8);
        for (uint256 i = 7; i >= 0 && value != 0; i--) {
            uint8 digit = uint8(value & 0xf);
            buffer[i] = digit < 10 ? bytes1(digit + 48) : bytes1(digit + 55);
            value >>= 4;
            if (i == 0) break;
        }
        return buffer;
    }

    // ============ Status Management ============

    /**
     * @notice Update tourist's safety status
     * @param _status New safety status (0=Safe, 1=Alert, 2=Danger)
     */
    function updateStatus(SafetyStatus _status) external onlyRegisteredTourist {
        Tourist storage tourist = tourists[_msgSender()];
        SafetyStatus oldStatus = tourist.status;
        tourist.status = _status;

        emit StatusUpdated(_msgSender(), tourist.touristId, oldStatus, _status, block.timestamp);

        // Create emergency alert for Alert/Danger status
        if (_status == SafetyStatus.Alert || _status == SafetyStatus.Danger) {
            _createEmergencyAlert(_msgSender(), _status, "", ZoneLevel.Low);
        }
    }

    /**
     * @notice Update tourist's location
     * @param _latitude Latitude multiplied by 1e6
     * @param _longitude Longitude multiplied by 1e6
     */
    function updateLocation(int256 _latitude, int256 _longitude) external onlyRegisteredTourist {
        Tourist storage tourist = tourists[_msgSender()];
        tourist.lastLatitude = _latitude;
        tourist.lastLongitude = _longitude;
        tourist.lastLocationUpdate = block.timestamp;

        emit LocationUpdated(_msgSender(), tourist.touristId, _latitude, _longitude, block.timestamp);

        // Check if in danger zone
        _checkDangerZoneEntry(_msgSender(), _latitude, _longitude);
    }

    /**
     * @notice Check if tourist entered a danger zone
     */
    function _checkDangerZoneEntry(
        address _tourist,
        int256 _latitude,
        int256 _longitude
    ) private {
        for (uint256 i = 0; i < dangerZones.length; i++) {
            if (!dangerZones[i].isActive) continue;

            DangerZone memory zone = dangerZones[i];

            // Simple distance check (approximate, uses Euclidean distance)
            int256 latDiff = _latitude - zone.latitude;
            int256 lngDiff = _longitude - zone.longitude;
            uint256 distance = uint256(_abs(latDiff) + _abs(lngDiff));

            // Convert radius to coordinate units (approximate)
            uint256 radiusInCoords = zone.radius * 10; // ~10 units per meter at equator

            if (distance <= radiusInCoords) {
                // Tourist is in danger zone
                Tourist storage tourist = tourists[_tourist];
                if (tourist.status == SafetyStatus.Safe) {
                    tourist.status = SafetyStatus.Alert;
                    _createEmergencyAlert(_tourist, SafetyStatus.Alert, zone.name, zone.level);
                }
            }
        }
    }

    function _abs(int256 x) private pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    // ============ Danger Zone Management ============

    /**
     * @notice Create a new danger zone
     * @param _name Zone name/description
     * @param _latitude Zone center latitude * 1e6
     * @param _longitude Zone center longitude * 1e6
     * @param _radius Zone radius in meters
     * @param _level Danger level (0=Low, 1=Medium, 2=High, 3=Critical)
     */
    function createDangerZone(
        string calldata _name,
        int256 _latitude,
        int256 _longitude,
        uint256 _radius,
        ZoneLevel _level
    ) external onlyAdmin returns (string memory) {
        require(bytes(_name).length > 0, "Zone name required");
        require(_radius > 0, "Radius must be positive");

        zoneCounter++;
        string memory zoneId = string(abi.encodePacked("ZONE-", _toHexString(zoneCounter)));

        dangerZones.push(DangerZone({
            zoneId: zoneId,
            name: _name,
            latitude: _latitude,
            longitude: _longitude,
            radius: _radius,
            level: _level,
            createdBy: _msgSender(),
            createdAt: block.timestamp,
            isActive: true
        }));

        zoneIdToIndex[zoneId] = dangerZones.length - 1;

        emit DangerZoneCreated(zoneId, _name, _latitude, _longitude, _radius, _level, _msgSender());

        return zoneId;
    }

    /**
     * @notice Update an existing danger zone
     * @param _zoneIndex Index of the zone to update
     * @param _name New zone name
     * @param _radius New radius
     * @param _level New danger level
     */
    function updateDangerZone(
        uint256 _zoneIndex,
        string calldata _name,
        uint256 _radius,
        ZoneLevel _level
    ) external onlyAdmin {
        require(_zoneIndex < dangerZones.length, "Invalid zone index");
        require(dangerZones[_zoneIndex].isActive, "Zone not active");

        DangerZone storage zone = dangerZones[_zoneIndex];
        zone.name = _name;
        zone.radius = _radius;
        zone.level = _level;

        emit DangerZoneUpdated(zone.zoneId, _name, _radius, _level);
    }

    /**
     * @notice Remove a danger zone
     * @param _zoneIndex Index of the zone to remove
     */
    function removeDangerZone(uint256 _zoneIndex) external onlyAdmin {
        require(_zoneIndex < dangerZones.length, "Invalid zone index");
        require(dangerZones[_zoneIndex].isActive, "Zone already inactive");

        dangerZones[_zoneIndex].isActive = false;

        emit DangerZoneRemoved(dangerZones[_zoneIndex].zoneId, _msgSender());
    }

    // ============ Emergency Alerts ============

    /**
     * @notice Create an emergency alert
     */
    function _createEmergencyAlert(
        address _tourist,
        SafetyStatus _status,
        string memory _zoneName,
        ZoneLevel _zoneLevel
    ) private {
        alertCounter++;
        string memory alertId = string(abi.encodePacked("ALERT-", _toHexString(alertCounter)));

        Tourist memory tourist = tourists[_tourist];

        alerts.push(EmergencyAlert({
            alertId: alertId,
            tourist: _tourist,
            touristId: tourist.touristId,
            status: _status,
            latitude: tourist.lastLatitude,
            longitude: tourist.lastLongitude,
            zoneName: _zoneName,
            zoneLevel: _zoneLevel,
            timestamp: block.timestamp,
            isDismissed: false
        }));

        alertCount++;

        emit EmergencyAlertCreated(alertId, _tourist, tourist.touristId, _status, block.timestamp);
    }

    /**
     * @notice Dismiss an alert
     * @param _alertIndex Index of the alert to dismiss
     */
    function dismissAlert(uint256 _alertIndex) external onlyAdmin {
        require(_alertIndex < alerts.length, "Invalid alert index");
        require(!alerts[_alertIndex].isDismissed, "Alert already dismissed");

        alerts[_alertIndex].isDismissed = true;
        alertCount--;

        emit AlertDismissed(alerts[_alertIndex].alertId, _msgSender());
    }

    // ============ View Functions ============

    /**
     * @notice Get tourist information by wallet address
     */
    function getTourist(address _wallet) external view returns (Tourist memory) {
        return tourists[_wallet];
    }

    /**
     * @notice Get tourist by tourist ID
     */
    function getTouristById(string calldata _touristId) external view returns (Tourist memory) {
        address wallet = touristIdToAddress[_touristId];
        require(wallet != address(0), "Tourist not found");
        return tourists[wallet];
    }

    /**
     * @notice Get all registered tourists (admin only)
     */
    function getAllTourists() external view onlyAdmin returns (Tourist[] memory) {
        Tourist[] memory allTourists = new Tourist[](registeredTourists.length);
        for (uint256 i = 0; i < registeredTourists.length; i++) {
            allTourists[i] = tourists[registeredTourists[i]];
        }
        return allTourists;
    }

    /**
     * @notice Get all danger zones
     */
    function getAllDangerZones() external view returns (DangerZone[] memory) {
        return dangerZones;
    }

    /**
     * @notice Get active danger zones only
     */
    function getActiveDangerZones() external view returns (DangerZone[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < dangerZones.length; i++) {
            if (dangerZones[i].isActive) activeCount++;
        }

        DangerZone[] memory activeZones = new DangerZone[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < dangerZones.length; i++) {
            if (dangerZones[i].isActive) {
                activeZones[index] = dangerZones[i];
                index++;
            }
        }
        return activeZones;
    }

    /**
     * @notice Get all alerts (admin only)
     */
    function getAllAlerts() external view onlyAdmin returns (EmergencyAlert[] memory) {
        return alerts;
    }

    /**
     * @notice Get active (non-dismissed) alerts
     */
    function getActiveAlerts() external view onlyAdmin returns (EmergencyAlert[] memory) {
        EmergencyAlert[] memory activeAlerts = new EmergencyAlert[](alertCount);
        uint256 index = 0;
        for (uint256 i = 0; i < alerts.length; i++) {
            if (!alerts[i].isDismissed) {
                activeAlerts[index] = alerts[i];
                index++;
            }
        }
        return activeAlerts;
    }

    /**
     * @notice Get all admins
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }

    /**
     * @notice Get total registered tourists count
     */
    function getTouristCount() external view returns (uint256) {
        return registeredTourists.length;
    }

    /**
     * @notice Check if wallet is registered
     */
    function isRegistered(address _wallet) external view returns (bool) {
        return tourists[_wallet].isActive;
    }

    /**
     * @notice Get tourists by status
     */
    function getTouristsByStatus(SafetyStatus _status) external view onlyAdmin returns (Tourist[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < registeredTourists.length; i++) {
            if (tourists[registeredTourists[i]].status == _status) count++;
        }

        Tourist[] memory result = new Tourist[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < registeredTourists.length; i++) {
            if (tourists[registeredTourists[i]].status == _status) {
                result[index] = tourists[registeredTourists[i]];
                index++;
            }
        }
        return result;
    }
}
