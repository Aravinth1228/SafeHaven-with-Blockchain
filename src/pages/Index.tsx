import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Wallet, 
  MapPin, 
  AlertTriangle, 
  Users, 
  CheckCircle,
  ArrowRight,
  Zap,
  Lock,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import MetaMaskGuide from '@/components/MetaMaskGuide';

const Index: React.FC = () => {
  const { isMetaMaskInstalled, connectWallet, isConnected, isConnecting } = useWallet();

  const features = [
    {
      icon: <Wallet className="w-8 h-8" />,
      title: 'Secure Identity',
      description: 'MetaMask-verified blockchain identity for maximum security',
    },
    {
      icon: <MapPin className="w-8 h-8" />,
      title: 'Live Tracking',
      description: 'Real-time location monitoring with instant updates',
    },
    {
      icon: <AlertTriangle className="w-8 h-8" />,
      title: 'Emergency Alerts',
      description: 'One-tap emergency button for instant help',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Admin Monitoring',
      description: '24/7 admin surveillance for tourist safety',
    },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Connect MetaMask',
      description: 'Link your blockchain wallet for secure identity verification',
    },
    {
      step: '02',
      title: 'Create Profile',
      description: 'Register with your details and get a unique Tourist ID',
    },
    {
      step: '03',
      title: 'Enable Tracking',
      description: 'Allow location tracking for real-time safety monitoring',
    },
    {
      step: '04',
      title: 'Stay Protected',
      description: 'Use emergency button if you feel unsafe - help arrives fast',
    },
  ];

  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 mb-8">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Blockchain-Powered Tourist Safety</span>
            </div>

            {/* Title */}
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Tourist Safety &{' '}
              <span className="gradient-text">Emergency Assistance</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Protect yourself with blockchain-verified identity, real-time location tracking, 
              and instant emergency alerts. Your safety is our priority.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button className="btn-gradient px-8 py-6 text-lg rounded-xl min-w-[200px]">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              
              {isMetaMaskInstalled ? (
                <Button
                  className="btn-outline-gradient px-8 py-6 text-lg rounded-xl min-w-[200px]"
                  onClick={connectWallet}
                  disabled={isConnecting || isConnected}
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </Button>
              ) : (
                <Button
                  className="btn-outline-gradient px-8 py-6 text-lg rounded-xl min-w-[200px]"
                  onClick={() => window.open('https://metamask.io/download/', '_blank')}
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Install MetaMask
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Why Choose <span className="gradient-text">SafeHaven</span>?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Advanced security features designed to keep tourists safe
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="feature-card group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple 4-step process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-display font-bold text-primary/20 mb-4">
                  {item.step}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 right-0 translate-x-1/2 text-primary/30">
                    <ArrowRight className="w-8 h-8" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MetaMask Installation Guide */}
      {!isMetaMaskInstalled && (
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-2xl">
            <MetaMaskGuide />
          </div>
        </section>
      )}

      {/* Security Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="glass-card rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">Blockchain Security</h3>
                <p className="text-muted-foreground text-sm">Immutable tourist ID linked to your wallet</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">Instant Response</h3>
                <p className="text-muted-foreground text-sm">Emergency alerts reach admins in seconds</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                  <Globe className="w-8 h-8" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">Global Coverage</h3>
                <p className="text-muted-foreground text-sm">Works anywhere with internet access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Ready to Travel <span className="gradient-text">Safely</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of tourists who trust SafeHaven for their safety
          </p>
          <Link to="/signup">
            <Button className="btn-gradient px-10 py-6 text-lg rounded-xl">
              Create Your Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-display font-bold gradient-text">SafeHaven</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 SafeHaven. Blockchain-powered tourist safety.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
