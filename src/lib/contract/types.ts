// Contract type definitions

export interface Tourist {
  touristId: string;
  username: string;
  email: string;
  phone: string;
  dob: bigint;
  status: number;
  registeredAt: bigint;
  isRegistered: boolean;
}

export interface DangerZone {
  id: bigint;
  name: string;
  lat: bigint;
  lng: bigint;
  radius: bigint;
  level: string;
  active: boolean;
}

export interface EmergencyAlert {
  tourist: string;
  touristId: string;
  lat: bigint;
  lng: bigint;
  timestamp: bigint;
  resolved: boolean;
}

// Coordinate conversion helpers (contract uses int256 with 6 decimal precision)
export const COORDINATE_PRECISION = 1000000n;

export function toContractCoordinate(coord: number): bigint {
  return BigInt(Math.round(coord * 1000000));
}

export function fromContractCoordinate(coord: bigint): number {
  return Number(coord) / 1000000;
}

// Date conversion helpers
export function toContractTimestamp(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 1000));
}

export function fromContractTimestamp(timestamp: bigint): Date {
  return new Date(Number(timestamp) * 1000);
}
