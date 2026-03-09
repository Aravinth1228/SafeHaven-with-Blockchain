import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, User, Mail, Phone, Calendar, Lock, CheckCircle, ArrowRight, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockchain } from '@/hooks/useBlockchain';
import MetaMaskGuide from '@/components/MetaMaskGuide';
import AddSepoliaButton from '@/components/blockchain/AddSepoliaButton';
import { useToast } from '@/hooks/use-toast';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isMetaMaskInstalled, connectWallet, isConnected, walletAddress, isConnecting } = useWallet();
  const { register } = useAuth();
  const { signAndRegister, checkRegistration } = useBlockchain();

  const [step, setStep] = useState<'connect' | 'form'>('connect');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearAllData = () => {
    if (!confirm('Clear all user data?\n\nThis will delete:\n- All local user accounts\n- Current session\n- Location data\n\nBlockchain data will NOT be deleted.')) {
      return;
    }

    const keysToClear = [
      'users',
      'currentUser',
      'adminWalletAddress',
      'isAdmin',
      'walletAddress',
    ];

    let count = 0;
    keysToClear.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        count++;
      }
    });

    // Clear location data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('userLocation-') || key.startsWith('notification-')) {
        localStorage.removeItem(key);
        count++;
      }
    });

    toast({
      title: 'Data Cleared',
      description: `Cleared ${count} items. Refreshing...`,
    });

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleConnect = async () => {
    console.log('🔗 Connect button clicked');
    try {
      await connectWallet();
      console.log('✅ Wallet connected');
      toast({
        title: 'Wallet Connected!',
        description: `Connected to ${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`,
      });
      setStep('form');
    } catch (error: any) {
      console.error('❌ Connection failed:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect MetaMask. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Auto-move to form when wallet connects
  useEffect(() => {
    if (walletAddress && step === 'connect') {
      setStep('form');
    }
  }, [walletAddress, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Phone number validation - only 10 digits
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length <= 10) {
        setFormData(prev => ({ ...prev, [name]: digitsOnly }));
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'Passwords do not match. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Weak Password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.phone.length !== 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Phone number must be exactly 10 digits.',
        variant: 'destructive',
      });
      return;
    }

    // Date of Birth Validation - User must be at least 18 years old
    const dob = new Date(formData.dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    
    if (age < 18) {
      toast({
        title: 'Invalid Date of Birth',
        description: `You must be at least 18 years old to register. Current age: ${age} years.`,
        variant: 'destructive',
      });
      return;
    }
    
    if (age > 120) {
      toast({
        title: 'Invalid Date of Birth',
        description: 'Please enter a valid date of birth.',
        variant: 'destructive',
      });
      return;
    }

    if (!walletAddress) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your MetaMask wallet first.',
        variant: 'destructive',
      });
      setStep('connect');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('🚀 Starting registration...');
      console.log('Wallet:', walletAddress);

      // Step 1: Check if already registered on blockchain
      toast({
        title: 'Checking Registration',
        description: 'Verifying if wallet is already registered...',
      });

      const isAlreadyRegistered = await checkRegistration();

      if (isAlreadyRegistered) {
        toast({
          title: 'Already Registered!',
          description: 'This wallet is already registered. Please login.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return;
      }

      // Step 2: Register on blockchain with ERC-2771 meta-transaction (NO GAS FEE)
      toast({
        title: 'Sign Registration',
        description: 'Please sign the message in MetaMask to register on blockchain',
      });

      const dateOfBirth = new Date(formData.dob);
      const dateOfBirthTimestamp = Math.floor(dateOfBirth.getTime() / 1000);

      // Register on blockchain using ERC-2771 meta-transaction
      const blockchainResult = await signAndRegister({
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: dateOfBirthTimestamp
      });

      console.log('✅ Blockchain registration successful:', blockchainResult);

      toast({
        title: '✅ Blockchain Registration Successful!',
        description: `Tourist ID: ${blockchainResult.data?.touristId || 'N/A'}`,
      });

      // Step 3: Register user in MongoDB (for faster queries and additional data)
      toast({
        title: 'Creating Profile',
        description: 'Saving your profile to database...',
      });

      // Get current location for initial registration
      let currentLat: number | undefined;
      let currentLng: number | undefined;

      try {
        // Try to get current location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });

        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
        // No reverse geocoding - only coordinates stored
      } catch (err) {
        console.warn('Could not get location for registration:', err);
      }

      const success = await register(
        {
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          dob: formData.dob,
          walletAddress: walletAddress,
          touristId: blockchainResult.data?.touristId || '',
        },
        formData.password,
        currentLat,
        currentLng
      );

      if (!success) {
        toast({
          title: 'Database Registration Warning',
          description: 'Blockchain registration succeeded but database registration failed. You can still login.',
          variant: 'default',
        });
        // Still redirect even if MongoDB fails - blockchain is the source of truth
      }

      // Auto-redirect to dashboard immediately
      toast({
        title: '🎉 Registration Successful!',
        description: 'Welcome to SafeHaven!',
      });

      toast({
        title: '📍 Next: Enable Location',
        description: 'After redirect, please allow location access to start tracking',
        duration: 5000,
      });

      // Redirect immediately (100ms for toast to show)
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (error: any) {
      console.error('Registration error:', error);

      let errorMessage = error.message || 'Something went wrong. Please try again.';

      // Handle specific error types
      if (error.message?.includes('Already registered')) {
        errorMessage = 'Wallet already registered on blockchain. Please login.';
      } else if (error.message?.includes('Signature expired')) {
        errorMessage = 'Signature expired. Please try again.';
      } else if (error.message?.includes('User rejected')) {
        errorMessage = 'You rejected the signature. Please sign to complete registration.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. Please ensure the server is running.';
      }

      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsSubmitting(false);
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

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-lg">
        {/* Clear Data Button */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={clearAllData}
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive border-destructive/50"
            title="Clear all user data"
          >
            <Trash2 className="w-4 h-4" />
            Clear Data
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {['Connect', 'Register'].map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${(step === 'connect' && index === 0) ||
                      (step === 'form' && index === 1)
                      ? 'bg-primary text-primary-foreground'
                      : index < (['connect', 'form'].indexOf(step))
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {index + 1}
                </div>
                <span className="text-xs mt-2 text-muted-foreground">{label}</span>
              </div>
              {index < 1 && (
                <div className={`w-16 h-0.5 ${index < ['connect', 'form'].indexOf(step)
                    ? 'bg-primary'
                    : 'bg-muted'
                  }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step: Connect Wallet */}
        {step === 'connect' && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-4">
              Connect Your <span className="gradient-text">Wallet</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              Connect your MetaMask wallet to create a blockchain-verified tourist identity.
            </p>
            
            {/* Network Status */}
            <div className="mb-6 p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">
                ⚠️ Make sure you're on <strong className="text-primary">Sepolia Testnet</strong>
              </p>
              <AddSepoliaButton />
            </div>
            
            <Button
              className="btn-gradient px-8 py-4 rounded-xl w-full"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              <Wallet className="w-5 h-5 mr-2" />
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          </div>
        )}

        {/* Step: Registration Form */}
        {step === 'form' && (
          <div className="glass-card rounded-2xl p-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-center">
              Create Your <span className="gradient-text">Profile</span>
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              Fill in your details to complete registration
            </p>

            {/* Connected Wallet */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30 mb-6">
              <CheckCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Connected Wallet</p>
                <p className="font-mono text-sm">{walletAddress?.slice(0, 10)}...{walletAddress?.slice(-8)}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>

              <div>
                <Label htmlFor="dob" className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Date of Birth
                </Label>
                <Input
                  id="dob"
                  name="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleInputChange}
                  required
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  title="You must be at least 18 years old to register"
                  className="bg-muted/50 border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ℹ️ You must be at least 18 years old to register
                </p>
              </div>

              <div>
                <Label htmlFor="password" className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Create a password"
                    required
                    className="bg-muted/50 border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    required
                    className="bg-muted/50 border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="btn-gradient w-full py-4 rounded-xl mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
                <CheckCircle className="w-3 h-3 text-success" />
                <span>Free registration - No fees</span>
              </div>
            </form>
          </div>
        )}

        {/* Login Link */}
        {step === 'connect' && (
          <p className="text-center mt-6 text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Login here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default SignUp;
