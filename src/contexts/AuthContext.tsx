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
  register: (userData: Omit<User, 'id' | 'touristId' | 'status' | 'createdAt'>, password: string) => Promise<boolean>;
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
  const { signAndRegister, signAndUpdateStatus, signAndUpdateLocation, checkRegistration } = useBlockchain();
  
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
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const userData = users[username.toLowerCase()];

    if (userData && userData.password === password) {
      const { password: _, ...userWithoutPassword } = userData;
      setUser(userWithoutPassword);
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
      return true;
    }
    return false;
  };

  const loginWithWallet = async (walletAddress: string): Promise<boolean> => {
    const users = JSON.parse(localStorage.getItem('users') || '{}');

    const foundUser = Object.values(users).find(
      (u: any) => u.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
    ) as any;

    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
      return true;
    }
    return false;
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
    password: string
  ): Promise<boolean> => {
    const username = userData.username.toLowerCase();

    // Check local storage for duplicate username
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[username]) {
      console.error('❌ Username already exists:', username);
      return false;
    }

    // Check if wallet is connected
    const currentWalletAddress = walletAddressRef.current;
    
    if (!currentWalletAddress) {
      console.error('⚠️ Wallet not connected. Please connect wallet first.');
      return false;
    }

    const id = crypto.randomUUID();
    const newUser: User = {
      ...userData,
      id,
      touristId: username,
      status: 'safe',
      createdAt: new Date().toISOString(),
    };

    users[username] = { ...newUser, password };
    localStorage.setItem('users', JSON.stringify(users));

    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));

    // Register on blockchain with meta-transaction
    try {
      console.log('📝 Registering on blockchain...');
      console.log('📝 Wallet Address:', currentWalletAddress);

      // Check if already registered on blockchain
      const alreadyRegistered = await checkRegistration();
      if (alreadyRegistered) {
        console.log('✅ User already registered on blockchain, skipping registration');
      } else {
        const dateOfBirth = Math.floor(new Date(userData.dob).getTime() / 1000);
        console.log('📝 Date of Birth (Unix):', dateOfBirth);

        const result = await signAndRegister({
          username: userData.username,
          email: userData.email,
          phone: userData.phone,
          dateOfBirth
        });

        console.log('✅ Blockchain registration successful:', result);
      }
    } catch (err: any) {
      // Check if it's an "already registered" error
      if (err.message?.includes('Already registered') || err.message?.includes('already registered')) {
        console.log('✅ User already registered on blockchain, continuing...');
      } else {
        console.error('❌ Blockchain registration failed:', err);
        console.error('Error details:', {
          message: err.message,
          reason: err.reason,
          code: err.code
        });

        // Rollback local storage
        delete users[username];
        localStorage.setItem('users', JSON.stringify(users));
        return false;
      }
    }

    return true;
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

      // Persist status to MongoDB backend
      try {
        await api.users.updateStatus(user.id, status);
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
            });
            console.log('✅ Location status updated in MongoDB');
          }
        } catch (locErr) {
          console.error('Failed to update location:', locErr);
        }
      } catch (err) {
        console.error('Failed to update profile status in MongoDB:', err);
      }

      // Blockchain status update temporarily disabled due to contract issues
      // Status is stored in MongoDB and visible on admin dashboard
      console.log('ℹ️ Blockchain status update skipped - using MongoDB storage');
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
      return {
        touristId: u.touristId,
        username: u.username,
        lat: savedLocation?.lat || 20.5937 + (Math.random() - 0.5) * 2,
        lng: savedLocation?.lng || 78.9629 + (Math.random() - 0.5) * 2,
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
