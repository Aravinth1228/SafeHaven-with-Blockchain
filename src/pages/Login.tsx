import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, ArrowRight, Shield, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, loginWithWallet } = useAuth();
  const { connectWallet, isMetaMaskInstalled, walletAddress, isConnecting } = useWallet();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'wallet'>('credentials');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        toast({
          title: 'Welcome Back!',
          description: 'Login successful. Redirecting to dashboard...',
        });
        navigate('/dashboard');
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid username or password.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    if (!isMetaMaskInstalled) {
      toast({
        title: 'MetaMask Not Found',
        description: 'Please install MetaMask to login with your wallet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await connectWallet();
      
      // Wait for wallet address to be available
      setTimeout(async () => {
        const address = localStorage.getItem('walletAddress');
        if (address) {
          const success = await loginWithWallet(address);
          if (success) {
            toast({
              title: 'Welcome Back!',
              description: 'Login successful via MetaMask.',
            });
            navigate('/dashboard');
          } else {
            toast({
              title: 'Account Not Found',
              description: 'No account linked to this wallet. Please sign up first.',
              variant: 'destructive',
            });
          }
        }
      }, 500);
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect MetaMask. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-md">
        <div className="glass-card rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">
              Welcome <span className="gradient-text">Back</span>
            </h2>
            <p className="text-muted-foreground">
              Login with your username and password
            </p>
          </div>

          {/* Login Method Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={loginMethod === 'credentials' ? 'default' : 'outline'}
              className={`flex-1 ${loginMethod === 'credentials' ? 'btn-gradient' : ''}`}
              onClick={() => setLoginMethod('credentials')}
            >
              <User className="w-4 h-4 mr-2" />
              Tourist ID
            </Button>
            <Button
              type="button"
              variant={loginMethod === 'wallet' ? 'default' : 'outline'}
              className={`flex-1 ${loginMethod === 'wallet' ? 'btn-gradient' : ''}`}
              onClick={() => setLoginMethod('wallet')}
            >
              <Wallet className="w-4 h-4 mr-2" />
              MetaMask
            </Button>
          </div>

          {loginMethod === 'credentials' ? (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="username" className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-primary" />
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>

              <div>
                <Label htmlFor="password" className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>

              <Button
                type="submit"
                className="btn-gradient w-full py-4 rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          ) : (
            /* MetaMask Login */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
                <Wallet className="w-12 h-12 text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your MetaMask wallet to login with your registered account
                </p>
                {walletAddress && (
                  <p className="text-xs font-mono text-primary mb-4 truncate">
                    Connected: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                  </p>
                )}
              </div>

              <Button
                type="button"
                className="btn-gradient w-full py-4 rounded-xl"
                onClick={handleMetaMaskLogin}
                disabled={isConnecting}
              >
                {isConnecting ? 'Connecting...' : 'Connect MetaMask & Login'}
                <Wallet className="w-5 h-5 ml-2" />
              </Button>

              {!isMetaMaskInstalled && (
                <p className="text-xs text-destructive text-center">
                  MetaMask is not installed.{' '}
                  <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="underline">
                    Install here
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Admin Login Link */}
          <div className="mt-6 pt-6 border-t border-border">
            <Link to="/admin-login">
              <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                <Shield className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          </div>

          {/* Sign Up Link */}
          <p className="text-center mt-6 text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
