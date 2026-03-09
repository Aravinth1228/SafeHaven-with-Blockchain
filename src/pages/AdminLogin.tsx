import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Wallet, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import MetaMaskGuide from '@/components/MetaMaskGuide';

// ─── ADMIN WALLET ─────────────────────────────────────────────────────────────
// .env file-ல் VITE_ADMIN_WALLET_ADDRESS=0xYourWallet என்று set பண்ணுங்க.
// .env இல்லன்னா fallback-ஆ hardcoded address use ஆகும்.
const ADMIN_WALLET_ADDRESS =
  import.meta.env.VITE_ADMIN_WALLET_ADDRESS || '0x548cb269df02005590CF48fb031dD697e52aa201';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isMetaMaskInstalled, connectWallet, isConnected, walletAddress, isConnecting } = useWallet();
  const { verifyAdminOnChain, isAdmin } = useAuth();

  const [isVerifying, setIsVerifying] = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    const savedAdmin = localStorage.getItem('isAdmin');
    const savedWallet = (localStorage.getItem('adminWalletAddress') || '').toLowerCase();

    if (savedAdmin === 'true' && savedWallet === ADMIN_WALLET_ADDRESS.toLowerCase()) {
      console.log('✅ Admin already verified, redirecting...');
      navigate('/admin');
    } else if (savedAdmin === 'true' && savedWallet !== ADMIN_WALLET_ADDRESS.toLowerCase()) {
      // Stale session from a different wallet — clear it
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminWalletAddress');
    }
  }, [navigate]);

  // Auto-verify when wallet connects
  useEffect(() => {
    if (isConnected && walletAddress && !isVerifying) {
      const isMatch = walletAddress.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();
      if (isMatch) {
        handleVerifyAdmin();
      }
    }
  }, [isConnected, walletAddress]);

  const handleVerifyAdmin = async () => {
    if (!walletAddress) return;

    // Wallet address check
    const isMatch = walletAddress.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();

    if (!isMatch) {
      toast({
        title: '🚫 Access Denied',
        description: `This wallet is not the admin wallet.\nAdmin: ${ADMIN_WALLET_ADDRESS.slice(0, 6)}...${ADMIN_WALLET_ADDRESS.slice(-4)}`,
        variant: 'destructive',
        duration: 6000,
      });
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);

    try {
      const isAdminVerified = await verifyAdminOnChain(walletAddress);

      if (isAdminVerified) {
        // Save verified wallet address alongside the flag
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminWalletAddress', walletAddress.toLowerCase());

        toast({
          title: '✅ Admin Verified!',
          description: 'Redirecting to dashboard...',
        });
        setTimeout(() => navigate('/admin'), 100);
      } else {
        toast({
          title: '🚫 Access Denied',
          description: 'On-chain verification failed.',
          variant: 'destructive',
        });
        setIsVerifying(false);
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify admin. Please try again.',
        variant: 'destructive',
      });
      setIsVerifying(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsVerifying(true);
      await connectWallet();
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect MetaMask. Please try again.',
        variant: 'destructive',
      });
      setIsVerifying(false);
    }
  };

  // Show MetaMask guide if not installed
  if (!isMetaMaskInstalled) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <MetaMaskGuide />
        </div>
      </div>
    );
  }

  const isAuthorizedWallet =
    walletAddress?.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase();

  return (
    <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-md">
        <div className="glass-card rounded-2xl p-8 text-center">

          {/* Header */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">
            Admin <span className="gradient-text">Portal</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Only authorized admin wallet can access
          </p>

          {/* Authorized Wallet Display */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 mb-6">
            <p className="text-xs text-muted-foreground mb-1">Authorized Admin Wallet:</p>
            <p className="font-mono text-sm text-primary">
              {ADMIN_WALLET_ADDRESS.slice(0, 10)}...{ADMIN_WALLET_ADDRESS.slice(-8)}
            </p>
          </div>

          {/* Connection Status */}
          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm font-medium">Wallet Connected</span>
                </div>
                <p className="font-mono text-sm text-muted-foreground">
                  {walletAddress?.slice(0, 10)}...{walletAddress?.slice(-8)}
                </p>
                {isAuthorizedWallet ? (
                  <p className="text-xs text-success mt-2">✅ Authorized Wallet</p>
                ) : (
                  <p className="text-xs text-destructive mt-2">
                    🚫 Not Authorized — Wrong wallet connected
                  </p>
                )}
              </div>

              {isVerifying && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Verifying admin...</span>
                </div>
              )}

              {!isVerifying && !isAdmin && (
                <Button
                  className="btn-gradient w-full py-4 rounded-xl"
                  onClick={handleVerifyAdmin}
                  disabled={!isAuthorizedWallet}
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Verify Admin Access
                </Button>
              )}

              {/* Wrong wallet warning */}
              {!isAuthorizedWallet && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-left">
                  <p className="text-xs text-destructive">
                    ⚠️ Switch to the admin wallet in MetaMask and reconnect.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <Button
              className="btn-gradient w-full py-4 rounded-xl"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              <Wallet className="w-5 h-5 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          )}

          {/* Info */}
          <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium mb-1">Admin Access Required</p>
                <p className="text-xs text-muted-foreground">
                  Only the pre-authorized wallet address can access the admin dashboard.
                  Wrong wallet connect பண்ணா login button disable ஆகும்.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminLogin;