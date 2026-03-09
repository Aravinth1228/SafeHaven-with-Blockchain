import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useBlockchain } from '@/hooks/useBlockchain';
import { useWallet } from '@/contexts/WalletContext';

interface User {
  id: string;
  touristId: string;
  username: string;
  email: string;
  phone: string;
  dob: string;
  walletAddress: string;
  status: 'safe' | 'alert' | 'danger';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVerifyingAdmin: boolean;
  adminWalletAddress: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithWallet: (walletAddress: string) => Promise<boolean>;
  verifyAdminOnChain: (walletAddress: string) => Promise<boolean>;
  adminLogout: () => void;
  logout: () => void;
  register: (userData: Omit<User, 'id' | 'touristId' | 'status' | 'createdAt'>, password: string, lat?: number, lng?: number) => Promise<boolean>;
  updateStatus: (status: 'safe' | 'alert' | 'danger') => Promise<void>;
  getAllUsers: () => User[];
  getUserLocations: () => { touristId: string; username: string; lat: number; lng: number; status: 'safe' | 'alert' | 'danger' }[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const ADMIN_WALLET = '0x548cb269df02005590CF48fb031dD697e52aa201';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [adminWalletAddress, setAdminWalletAddress] = useState<string | null>(null);

  // Wallet and blockchain hooks
  const { walletAddress, isConnected } = useWallet();
  const { signAndRegister, signAndUpdateStatus, checkRegistration } = useBlockchain();

  // Use refs to always get current wallet address in callbacks
  const walletAddressRef = useRef<string | null>(walletAddress);
  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    const savedAdminWallet = localStorage.getItem('adminWalletAddress');

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    if (savedAdminWallet) {
      verifyAdminOnChain(savedAdminWallet);
    }
  }, []);

  const verifyAdminOnChain = useCallback(async (walletAddress: string): Promise<boolean> => {
    try {
      setIsVerifyingAdmin(true);

      const isHardcodedAdmin = walletAddress.toLowerCase() === ADMIN_WALLET.toLowerCase();

      if (isHardcodedAdmin) {
        setIsAdmin(true);
        setAdminWalletAddress(walletAddress);
        localStorage.setItem('adminWalletAddress', walletAddress);
        localStorage.setItem('isAdmin', 'true');
        return true;
      }

      setIsAdmin(false);
      setAdminWalletAddress(null);
      localStorage.removeItem('adminWalletAddress');
      localStorage.removeItem('isAdmin');
      return false;
    } catch (error) {
      console.error('Failed to verify admin:', error);
      setIsAdmin(false);
      setAdminWalletAddress(null);
      localStorage.removeItem('adminWalletAddress');
      localStorage.removeItem('isAdmin');
      return false;
    } finally {
      setIsVerifyingAdmin(false);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Call backend API for login
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiBaseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Login failed:', result.error);
        return false;
      }

      // Store user data (without password)
      const userData = {
        id: result.data._id || result.data.user_id,
        touristId: result.data.tourist_id,
        username: result.data.username,
        email: result.data.email || '',
        phone: result.data.phone || '',
        dob: result.data.dob || '',
        walletAddress: result.data.wallet_address || '',
        status: result.data.status as 'safe' | 'alert' | 'danger',
        createdAt: result.data.created_at || new Date().toISOString(),
      };

      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      console.log('✅ Login successful:', userData.username);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginWithWallet = async (walletAddress: string): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      
      // Get user by wallet address from backend
      const response = await fetch(`${apiBaseUrl}/users`);
      const result = await response.json();
      
      if (!result.success) {
        console.error('Failed to fetch users');
        return false;
      }
      
      const foundUser = result.data?.find(
        (u: any) => u.wallet_address?.toLowerCase() === walletAddress.toLowerCase()
      );

      if (foundUser) {
        const userData = {
          id: foundUser._id || foundUser.user_id,
          touristId: foundUser.tourist_id,
          username: foundUser.username,
          email: foundUser.email || '',
          phone: foundUser.phone || '',
          dob: foundUser.dob || '',
          walletAddress: foundUser.wallet_address,
          status: foundUser.status as 'safe' | 'alert' | 'danger',
          createdAt: foundUser.created_at || new Date().toISOString(),
        };
        
        setUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ Wallet login successful:', userData.username);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Wallet login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAdmin');
  };

  const adminLogout = () => {
    setIsAdmin(false);
    setAdminWalletAddress(null);
    localStorage.removeItem('adminWalletAddress');
    localStorage.removeItem('isAdmin');
  };

  const register = async (
    userData: Omit<User, 'id' | 'touristId' | 'status' | 'createdAt'>,
    password: string,
    lat?: number,
    lng?: number
  ): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

      // Generate tourist ID if not provided
      const touristId = userData.touristId || `TID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const response = await fetch(`${apiBaseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          email: userData.email,
          phone: userData.phone,
          dob: userData.dob,
          wallet_address: userData.walletAddress,
          password: password,
          tourist_id: touristId,
          user_id: '',
          lat,
          lng
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ MongoDB registration failed:', result.error);

        // If username already exists, try to login with the existing user
        if (result.error && result.error.includes('Username already taken')) {
          console.log('⚠️ Username already exists, fetching existing user...');

          // Fetch all users to find the matching username
          const usersResponse = await fetch(`${apiBaseUrl}/users`);
          const usersResult = await usersResponse.json();

          if (usersResult.success) {
            const existingUser = usersResult.data?.find(
              (u: any) => u.username?.toLowerCase() === userData.username.toLowerCase()
            );

            if (existingUser) {
              // Update wallet address for existing user if it doesn't match
              if (existingUser.wallet_address?.toLowerCase() !== userData.walletAddress.toLowerCase()) {
                console.log('⚠️ Wallet mismatch - user may have registered with different wallet');
              }

              // Create user object from existing data
              const newUser: User = {
                id: existingUser._id || existingUser.user_id,
                touristId: existingUser.tourist_id,
                username: existingUser.username,
                email: existingUser.email || '',
                phone: existingUser.phone || '',
                dob: existingUser.dob || '',
                walletAddress: existingUser.wallet_address,
                status: existingUser.status || 'safe',
                createdAt: existingUser.created_at || new Date().toISOString(),
              };

              setUser(newUser);
              localStorage.setItem('currentUser', JSON.stringify(newUser));
              console.log('✅ Using existing user from MongoDB');
              return true;
            }
          }
        }

        return false;
      }

      // Create local user object
      const newUser: User = {
        id: result.data._id || result.data.user_id || touristId,
        touristId: result.data.tourist_id || touristId,
        username: result.data.username,
        email: result.data.email || '',
        phone: result.data.phone || '',
        dob: result.data.dob || '',
        walletAddress: result.data.wallet_address,
        status: result.data.status || 'safe',
        createdAt: result.data.created_at || new Date().toISOString(),
      };

      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));

      console.log('✅ User registered in MongoDB successfully');
      return true;
    } catch (err) {
      console.error('❌ MongoDB registration error:', err);
      return false;
    }
  };

  const updateStatus = async (status: 'safe' | 'alert' | 'danger') => {
    if (user) {
      const updatedUser = { ...user, status };
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      const users = JSON.parse(localStorage.getItem('users') || '{}');
      if (users[user.touristId]) {
        users[user.touristId] = { ...users[user.touristId], status };
        localStorage.setItem('users', JSON.stringify(users));
      }

      // Persist status to MongoDB backend ONLY (NO BLOCKCHAIN)
      try {
        // Use tourist_id for status update (more reliable)
        await api.users.updateStatus(user.touristId, status);
        console.log('✅ Profile status updated in MongoDB:', status);

        // Also update location status for real-time tracking
        try {
          const locationData = JSON.parse(localStorage.getItem(`userLocation-${user.touristId}`) || '{}');
          if (locationData.lat && locationData.lng) {
            await api.locations.update({
              user_id: user.id,
              tourist_id: user.touristId,
              lat: locationData.lat,
              lng: locationData.lng,
              username: user.username,
              status: status,
            });
            console.log('✅ Location status updated in MongoDB');
          }
        } catch (locErr) {
          console.error('Failed to update location:', locErr);
        }
      } catch (err) {
        console.error('Failed to update profile status in MongoDB:', err);
      }
    }
  };

  const getAllUsers = (): User[] => {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    return Object.values(users).map((u: any) => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
  };

  const getUserLocations = () => {
    const users = getAllUsers();
    return users.map((u) => {
      const savedLocation = JSON.parse(localStorage.getItem(`userLocation-${u.touristId}`) || 'null');

      // Return location if it exists in localStorage
      if (savedLocation && savedLocation.lat && savedLocation.lng) {
        return {
          touristId: u.touristId,
          username: u.username,
          lat: savedLocation.lat,
          lng: savedLocation.lng,
          status: u.status,
        };
      }

      // Return null location if no GPS data available
      return {
        touristId: u.touristId,
        username: u.username,
        lat: null,
        lng: null,
        status: u.status,
      };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin,
        isVerifyingAdmin,
        adminWalletAddress,
        login,
        loginWithWallet,
        verifyAdminOnChain,
        logout,
        adminLogout,
        register,
        updateStatus,
        getAllUsers,
        getUserLocations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { ADMIN_WALLET };
