// Contract module exports
export { contractService } from './contractService';
export { TOURIST_SAFETY_ABI, CONTRACT_ADDRESSES, TouristStatus, ZoneLevel } from './abi';
export type { NetworkName, TouristStatusType, ZoneLevelType } from './abi';
export type { Tourist, DangerZone, EmergencyAlert } from './types';
export {
  toContractCoordinate,
  fromContractCoordinate,
  toContractTimestamp,
  fromContractTimestamp,
  COORDINATE_PRECISION,
} from './types';
