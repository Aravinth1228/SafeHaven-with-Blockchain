import React from 'react';
import { Shield, Users, Globe, Lock, Zap, Heart, Target, Award } from 'lucide-react';

const About: React.FC = () => {
  const features = [
    {
      icon: <Lock className="w-8 h-8" />,
      title: 'Blockchain Security',
      description: 'Your identity is secured using MetaMask blockchain technology, ensuring immutable and tamper-proof verification.',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Real-Time Tracking',
      description: 'Advanced GPS tracking provides live location updates to ensure you can be found in emergencies.',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: '24/7 Monitoring',
      description: 'Our dedicated admin team monitors tourist safety around the clock, ready to respond instantly.',
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: 'Global Coverage',
      description: 'Works anywhere in the world with an internet connection, keeping you safe wherever you travel.',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Protected Tourists' },
    { value: '99.9%', label: 'Uptime' },
    { value: '<30s', label: 'Response Time' },
    { value: '180+', label: 'Countries' },
  ];

  const team = [
    { role: 'Founder & CEO', description: 'Leading the mission to make travel safer worldwide.' },
    { role: 'CTO', description: 'Building cutting-edge blockchain security solutions.' },
    { role: 'Head of Safety', description: 'Managing our global emergency response network.' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 mb-6">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">About SafeHaven</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Making Travel <span className="gradient-text">Safer</span> for Everyone
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            SafeHaven combines blockchain technology with real-time tracking to create 
            the most advanced tourist safety platform in the world.
          </p>
        </div>

        {/* Mission */}
        <div className="glass-card rounded-3xl p-8 md:p-12 mb-16">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Target className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground">
                To provide every tourist with peace of mind through cutting-edge safety technology. 
                We believe that exploring the world should be exciting, not dangerous. By leveraging 
                blockchain-verified identity and real-time emergency response systems, we're creating 
                a global safety net for travelers everywhere.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center p-6 glass-card rounded-2xl">
              <p className="font-display text-3xl md:text-4xl font-bold gradient-text mb-2">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            How We <span className="gradient-text">Protect</span> You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Technology */}
        <div className="glass-card rounded-3xl p-8 md:p-12 mb-16">
          <h2 className="font-display text-2xl font-bold mb-6 text-center">
            Powered by <span className="gradient-text">Blockchain</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">MetaMask Integration</h3>
              <p className="text-sm text-muted-foreground">
                Secure wallet connection for verified identity
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Immutable Records</h3>
              <p className="text-sm text-muted-foreground">
                Tourist IDs linked to blockchain for security
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Instant Verification</h3>
              <p className="text-sm text-muted-foreground">
                Quick and secure identity confirmation
              </p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 mb-6">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Our Values</span>
          </div>
          <h2 className="font-display text-3xl font-bold mb-8">
            Safety. Security. <span className="gradient-text">Peace of Mind.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            We're committed to making the world a safer place for travelers. 
            Every feature we build, every update we release, is designed with 
            your safety as the top priority.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
