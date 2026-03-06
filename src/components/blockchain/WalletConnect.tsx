import React from 'react';
import { useBlockchain } from '../hooks/useBlockchain';
import { ConnectButton } from '@rainbow-me/rainbowkit';

/**
 * WalletConnect Component
 *
 * Provides wallet connection UI using RainbowKit's ConnectButton
 * RainbowKit handles wallet selection and connection UI
 * ethers.js is used for EIP712 signing (via blockchainService)
 */
export function WalletConnect() {
  const {
    isConnected,
    address,
    disconnect
  } = useBlockchain();

  // Format address for display (0x1234...5678)
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="wallet-connect-container">
      {/* 
        RainbowKit ConnectButton provides:
        - Wallet selection modal
        - Connection status
        - Account menu with copy address, disconnect, etc.
      */}
      <ConnectButton
        showBalance={true}
        chainStatus="full"
        accountStatus={{
          smallScreen: 'avatar',
          largeScreen: 'full',
        }}
      />
      
      {/* Additional connection info (optional) */}
      {isConnected && address && (
        <div className="wallet-info" style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
          <span>Connected: {formatAddress(address)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * BlockchainRegistration Component
 * 
 * Handles user registration on blockchain with MetaMask signing
 */
export function BlockchainRegistration({ onComplete }: { onComplete?: () => void }) {
  const {
    isConnected,
    address,
    connectWallet,
    signAndRegister,
    checkRegistration
  } = useBlockchain();

  const [isRegistering, setIsRegistering] = React.useState(false);
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [formData, setFormData] = React.useState({
    username: '',
    email: '',
    phone: '',
    dob: ''
  });

  React.useEffect(() => {
    if (isConnected && address) {
      checkRegistration().then(setIsRegistered);
    }
  }, [isConnected, address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      await connectWallet();
      return;
    }

    setIsRegistering(true);

    try {
      const result = await signAndRegister({
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: new Date(formData.dob).getTime() / 1000
      });

      console.log('✅ Registration successful:', result);
      setIsRegistered(true);
      onComplete?.();
    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      alert(`Registration failed: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="registration-success">
        <p>✅ You are registered on the blockchain</p>
      </div>
    );
  }

  return (
    <div className="blockchain-registration">
      <h3>Register on Blockchain</h3>
      <p className="description">
        Register your wallet to enable gasless emergency alerts
      </p>

      {!isConnected ? (
        <button onClick={connectWallet} className="connect-btn">
          Connect Wallet to Register
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Date of Birth</label>
            <input
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              required
            />
          </div>

          <div className="wallet-info">
            <p>Wallet: {address}</p>
            <p className="gas-info">⛽ You won't pay gas fees - our relayer covers transaction costs</p>
          </div>

          <button 
            type="submit" 
            disabled={isRegistering}
            className="submit-btn"
          >
            {isRegistering ? 'Registering...' : 'Sign & Register'}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * EmergencyButton Component
 * 
 * Allows users to send emergency alerts with a single click
 * User signs message with MetaMask (no gas fee)
 */
export function EmergencyButton() {
  const { signAndUpdateStatus, isConnected } = useBlockchain();
  const [isSending, setIsSending] = React.useState(false);

  const handleEmergency = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!confirm('Send emergency alert? This will notify admins of your location.')) {
      return;
    }

    setIsSending(true);

    try {
      // Status 2 = Danger/Emergency
      const result = await signAndUpdateStatus(2);
      console.log('✅ Emergency alert sent:', result);
      alert('🚨 Emergency alert sent! Help is on the way.');
    } catch (error: any) {
      console.error('❌ Failed to send emergency:', error);
      alert(`Failed to send emergency: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <button
      onClick={handleEmergency}
      disabled={isSending || !isConnected}
      className="emergency-button"
    >
      {isSending ? 'Sending Alert...' : '🚨 EMERGENCY'}
    </button>
  );
}

export default { WalletConnect, BlockchainRegistration, EmergencyButton };
