import { ethers, BrowserProvider, Contract } from 'ethers';
import { TOURIST_SAFETY_ABI, CONTRACT_ADDRESSES, TouristStatus, ZoneLevel, NetworkName } from './abi';
import {
  Tourist,
  DangerZone,
  EmergencyAlert,
  toContractCoordinate,
  fromContractCoordinate,
  toContractTimestamp,
  fromContractTimestamp,
} from './types';

class ContractService {
  private provider: BrowserProvider | null = null;
  private contract: Contract | null = null;
  private signer: ethers.Signer | null = null;
  private contractAddress: string = '';

  // Initialize the service with MetaMask
  async initialize(): Promise<boolean> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      this.provider = new BrowserProvider(window.ethereum);
      const network = await this.provider.getNetwork();
      const networkName = this.getNetworkName(network.chainId);
      
      this.contractAddress = CONTRACT_ADDRESSES[networkName] || CONTRACT_ADDRESSES.localhost;
      
      if (!this.contractAddress) {
        throw new Error(`Contract not deployed on network: ${networkName}`);
      }

      this.signer = await this.provider.getSigner();
      this.contract = new Contract(this.contractAddress, TOURIST_SAFETY_ABI, this.signer);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize contract service:', error);
      throw error;
    }
  }

  private getNetworkName(chainId: bigint): NetworkName {
    const chainIdMap: Record<string, NetworkName> = {
      '1': 'mainnet',
      '11155111': 'sepolia',
      '31337': 'localhost',
    };
    return chainIdMap[chainId.toString()] || 'localhost';
  }

  private ensureInitialized(): void {
    if (!this.contract || !this.signer) {
      throw new Error('Contract service not initialized. Call initialize() first.');
    }
  }

  // ==================== Tourist Functions ====================

  // Register tourist (no fee in this contract version)
  async registerTourist(
    username: string,
    email: string,
    phone: string,
    dob: Date
  ): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    
    const dobTimestamp = toContractTimestamp(dob);
    
    const tx = await this.contract!.registerTourist(
      username, 
      email, 
      phone, 
      dobTimestamp
    );
    return tx;
  }

  // Get contract owner
  async getOwner(): Promise<string> {
    this.ensureInitialized();
    return await this.contract!.owner();
  }

  async getTourist(address: string): Promise<Tourist | null> {
    this.ensureInitialized();
    try {
      const tourist = await this.contract!.getTourist(address);
      if (!tourist.isActive) return null;
      return {
        touristId: tourist.touristId,
        username: tourist.username,
        email: tourist.email,
        phone: tourist.phone,
        dob: tourist.dateOfBirth,
        status: tourist.status,
        registeredAt: tourist.registeredAt,
        isRegistered: tourist.isActive,
      };
    } catch {
      return null;
    }
  }

  async getTouristById(touristId: string): Promise<Tourist | null> {
    this.ensureInitialized();
    try {
      const tourist = await this.contract!.getTouristById(touristId);
      if (!tourist.isActive) return null;
      return {
        touristId: tourist.touristId,
        username: tourist.username,
        email: tourist.email,
        phone: tourist.phone,
        dob: tourist.dateOfBirth,
        status: tourist.status,
        registeredAt: tourist.registeredAt,
        isRegistered: tourist.isActive,
      };
    } catch {
      return null;
    }
  }

  async isTouristRegistered(address: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.contract!.isRegistered(address);
  }

  async getTouristCount(): Promise<number> {
    this.ensureInitialized();
    const count = await this.contract!.getTouristCount();
    return Number(count);
  }

  async getAllTourists(): Promise<Tourist[]> {
    this.ensureInitialized();
    const tourists = await this.contract!.getAllTourists();
    return tourists.map((t: any) => ({
      touristId: t.touristId,
      username: t.username,
      email: t.email,
      phone: t.phone,
      dob: t.dateOfBirth,
      status: t.status,
      registeredAt: t.registeredAt,
      isRegistered: t.isActive,
      lastLatitude: t.lastLatitude,
      lastLongitude: t.lastLongitude,
      lastLocationUpdate: t.lastLocationUpdate,
    }));
  }

  async updateStatus(status: keyof typeof TouristStatus): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const statusValue = TouristStatus[status];
    const tx = await this.contract!.updateStatus(statusValue);
    return tx;
  }

  async updateLocation(lat: number, lng: number): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const contractLat = toContractCoordinate(lat);
    const contractLng = toContractCoordinate(lng);
    const tx = await this.contract!.updateLocation(contractLat, contractLng);
    return tx;
  }

  // ==================== Admin Functions ====================

  async isAdmin(address: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.contract!.isAdmin(address);
  }

  async getAdmins(): Promise<string[]> {
    this.ensureInitialized();
    return await this.contract!.getAdmins();
  }

  async addAdmin(address: string): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const tx = await this.contract!.addAdmin(address);
    return tx;
  }

  async removeAdmin(address: string): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const tx = await this.contract!.removeAdmin(address);
    return tx;
  }

  async dismissAlert(alertIndex: number): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const tx = await this.contract!.dismissAlert(alertIndex);
    return tx;
  }

  // ==================== Danger Zone Functions ====================

  async createDangerZone(
    name: string,
    lat: number,
    lng: number,
    radius: number,
    level: keyof typeof ZoneLevel
  ): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const contractLat = toContractCoordinate(lat);
    const contractLng = toContractCoordinate(lng);
    const levelValue = ZoneLevel[level];
    const tx = await this.contract!.createDangerZone(name, contractLat, contractLng, BigInt(radius), levelValue);
    return tx;
  }

  async updateDangerZone(
    zoneIndex: number,
    name: string,
    radius: number,
    level: keyof typeof ZoneLevel
  ): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const levelValue = ZoneLevel[level];
    const tx = await this.contract!.updateDangerZone(zoneIndex, name, BigInt(radius), levelValue);
    return tx;
  }

  async removeDangerZone(zoneIndex: number): Promise<ethers.ContractTransactionResponse> {
    this.ensureInitialized();
    const tx = await this.contract!.removeDangerZone(zoneIndex);
    return tx;
  }

  async getAllDangerZones(): Promise<Array<DangerZone & { latNum: number; lngNum: number }>> {
    this.ensureInitialized();
    const zones = await this.contract!.getAllDangerZones();
    return zones.map((zone: any) => ({
      zoneId: zone.zoneId,
      name: zone.name,
      lat: zone.latitude,
      lng: zone.longitude,
      latNum: fromContractCoordinate(zone.latitude),
      lngNum: fromContractCoordinate(zone.longitude),
      radius: Number(zone.radius),
      level: zone.level,
      createdBy: zone.createdBy,
      createdAt: zone.createdAt,
      active: zone.isActive,
    }));
  }

  async getActiveDangerZones(): Promise<Array<DangerZone & { latNum: number; lngNum: number }>> {
    this.ensureInitialized();
    const zones = await this.contract!.getActiveDangerZones();
    return zones.map((zone: any) => ({
      zoneId: zone.zoneId,
      name: zone.name,
      lat: zone.latitude,
      lng: zone.longitude,
      latNum: fromContractCoordinate(zone.latitude),
      lngNum: fromContractCoordinate(zone.longitude),
      radius: Number(zone.radius),
      level: zone.level,
      createdBy: zone.createdBy,
      createdAt: zone.createdAt,
      active: zone.isActive,
    }));
  }

  // ==================== Emergency Alert Functions ====================

  async getAllAlerts(): Promise<Array<EmergencyAlert & { latNum: number; lngNum: number; date: Date }>> {
    this.ensureInitialized();
    const alerts = await this.contract!.getAllAlerts();
    return alerts.map((alert: any) => ({
      alertId: alert.alertId,
      tourist: alert.tourist,
      touristId: alert.touristId,
      status: alert.status,
      lat: alert.latitude,
      lng: alert.longitude,
      latNum: fromContractCoordinate(alert.latitude),
      lngNum: fromContractCoordinate(alert.longitude),
      zoneName: alert.zoneName,
      zoneLevel: alert.zoneLevel,
      timestamp: alert.timestamp,
      date: fromContractTimestamp(alert.timestamp),
      resolved: alert.isDismissed,
    }));
  }

  async getActiveAlerts(): Promise<Array<EmergencyAlert & { latNum: number; lngNum: number; date: Date }>> {
    this.ensureInitialized();
    const alerts = await this.contract!.getActiveAlerts();
    return alerts.map((alert: any) => ({
      alertId: alert.alertId,
      tourist: alert.tourist,
      touristId: alert.touristId,
      status: alert.status,
      lat: alert.latitude,
      lng: alert.longitude,
      latNum: fromContractCoordinate(alert.latitude),
      lngNum: fromContractCoordinate(alert.longitude),
      zoneName: alert.zoneName,
      zoneLevel: alert.zoneLevel,
      timestamp: alert.timestamp,
      date: fromContractTimestamp(alert.timestamp),
      resolved: alert.isDismissed,
    }));
  }

  async getAlertCount(): Promise<number> {
    this.ensureInitialized();
    const count = await this.contract!.alertCount();
    return Number(count);
  }

  // ==================== Event Listeners ====================

  onTouristRegistered(callback: (wallet: string, touristId: string, username: string, timestamp: bigint) => void): void {
    this.ensureInitialized();
    this.contract!.on('TouristRegistered', callback);
  }

  onStatusUpdated(callback: (tourist: string, touristId: string, oldStatus: number, newStatus: number, timestamp: bigint) => void): void {
    this.ensureInitialized();
    this.contract!.on('StatusUpdated', callback);
  }

  onLocationUpdated(callback: (tourist: string, touristId: string, lat: bigint, lng: bigint, timestamp: bigint) => void): void {
    this.ensureInitialized();
    this.contract!.on('LocationUpdated', callback);
  }

  onEmergencyAlertCreated(callback: (alertId: string, tourist: string, touristId: string, status: number, timestamp: bigint) => void): void {
    this.ensureInitialized();
    this.contract!.on('EmergencyAlertCreated', callback);
  }

  onDangerZoneCreated(callback: (zoneId: string, name: string, lat: bigint, lng: bigint, radius: bigint, level: number, createdBy: string) => void): void {
    this.ensureInitialized();
    this.contract!.on('DangerZoneCreated', callback);
  }

  onAdminAdded(callback: (admin: string, addedBy: string) => void): void {
    this.ensureInitialized();
    this.contract!.on('AdminAdded', callback);
  }

  onAdminRemoved(callback: (admin: string, removedBy: string) => void): void {
    this.ensureInitialized();
    this.contract!.on('AdminRemoved', callback);
  }

  removeAllListeners(): void {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
  }

  // ==================== Utility ====================

  getContractAddress(): string {
    return this.contractAddress;
  }

  async getSignerAddress(): Promise<string> {
    this.ensureInitialized();
    return await this.signer!.getAddress();
  }
}

// Singleton instance
export const contractService = new ContractService();
