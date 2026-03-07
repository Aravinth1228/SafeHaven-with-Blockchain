// API base URL - Node.js backend
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

async function fetchAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

// Health check
export const checkHealth = () => fetchAPI("/health");

// Registration
export const registerUser = (profile: {
  username: string;
  email: string;
  phone: string;
  dob: string;
  wallet_address: string;
  tourist_id?: string;
  user_id?: string;
}) =>
  fetchAPI("/register", {
    method: "POST",
    body: JSON.stringify(profile),
  });

// Users
export const getAllUsers = () => fetchAPI("/users");
export const getUserById = (userId: string) => fetchAPI(`/users/${userId}`);
export const updateUserStatus = (userId: string, status: string) =>
  fetchAPI(`/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// Danger Zones
export const getDangerZones = () => fetchAPI("/danger-zones");
export const createDangerZone = (zone: {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: string;
  created_by?: string;
}) =>
  fetchAPI("/danger-zones", {
    method: "POST",
    body: JSON.stringify(zone),
  });
export const deleteDangerZone = (zoneId: string) =>
  fetchAPI(`/danger-zones/${zoneId}`, { method: "DELETE" });

// Blockchain Danger Zones
export const getBlockchainDangerZones = () => fetchAPI("/blockchain/danger-zones");
export const getBlockchainActiveDangerZones = () => fetchAPI("/blockchain/danger-zones/active");
export const getBlockchainDangerZoneCount = () => fetchAPI("/blockchain/danger-zones/count");
export const createBlockchainDangerZone = (zoneData: {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  level: string;
  created_by: string;
  signature?: string;
  message?: any;
}) =>
  fetchAPI("/blockchain/danger-zones", {
    method: "POST",
    body: JSON.stringify(zoneData),
  });
export const deleteBlockchainDangerZone = (index: number) =>
  fetchAPI(`/blockchain/danger-zones/${index}`, {
    method: "DELETE",
  });
export const updateBlockchainDangerZone = (index: number, zoneData: {
  name: string;
  radius: number;
  level: string;
  created_by: string;
  signature?: string;
  message?: any;
}) =>
  fetchAPI(`/blockchain/danger-zones/${index}`, {
    method: "PUT",
    body: JSON.stringify(zoneData),
  });

// Alerts
export const getActiveAlerts = () => fetchAPI("/alerts");
export const dismissAlert = (alertId: string) =>
  fetchAPI(`/alerts/${alertId}/dismiss`, { method: "PATCH" });

// Create alert
export const createAlert = async (alert: {
  user_id: string;
  tourist_id: string;
  username: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  zone_name?: string | null;
  zone_level?: string | null;
  alert_type?: string;
}) => {
  // For creating alerts, we'll use the locations endpoint which auto-creates alerts
  // Or we can create a dedicated alert endpoint if needed
  const response = await fetch(`${API_BASE}/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...alert,
      dismissed: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to create alert");
  return { data: data.data };
};

// Locations
export const updateUserLocation = (location: {
  user_id: string;
  tourist_id: string;
  lat: number;
  lng: number;
  username?: string;
}) =>
  fetchAPI("/locations", {
    method: "POST",
    body: JSON.stringify(location),
  });

// Get all locations
export const getAllLocations = () => fetchAPI("/locations");

// Analytics
export const getAnalytics = () => fetchAPI("/analytics");

// Notifications
export const sendNotification = async (notification: {
  tourist_id: string;
  user_id: string;
  admin_wallet: string;
  message: string;
  notification_type?: string;
}) => {
  const data = await fetchAPI("/notifications", {
    method: "POST",
    body: JSON.stringify(notification),
  });
  return { data: data.data };
};

export const getNotificationsForUser = async (touristId: string) => {
  const data = await fetchAPI(`/notifications/${touristId}`);
  return { data: data.data };
};

export const markNotificationRead = async (id: string) => {
  await fetchAPI(`/notifications/${id}/read`, { method: "PATCH" });
};

// Export API object for convenience
export const api = {
  health: checkHealth,
  register: registerUser,
  users: {
    getAll: getAllUsers,
    getById: getUserById,
    updateStatus: updateUserStatus,
  },
  dangerZones: {
    getAll: getDangerZones,
    create: createDangerZone,
    delete: deleteDangerZone,
  },
  blockchainDangerZones: {
    getAll: getBlockchainDangerZones,
    getActive: getBlockchainActiveDangerZones,
    getCount: getBlockchainDangerZoneCount,
    create: createBlockchainDangerZone,
    delete: deleteBlockchainDangerZone,
  },
  alerts: {
    getActive: getActiveAlerts,
    dismiss: dismissAlert,
    create: createAlert,
  },
  locations: {
    update: updateUserLocation,
    getAll: getAllLocations,
  },
  notifications: {
    send: sendNotification,
    getForUser: getNotificationsForUser,
    markRead: markNotificationRead,
  },
  analytics: getAnalytics,
};
