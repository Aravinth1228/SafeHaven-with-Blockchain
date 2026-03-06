import React from 'react';
import { ExternalLink, Download, Key, Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MetaMaskGuide: React.FC = () => {
  const steps = [
    {
      icon: <ExternalLink className="w-6 h-6" />,
      title: 'Visit MetaMask',
      description: 'Go to metamask.io in your browser',
    },
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Install Extension',
      description: 'Download the browser extension or mobile app',
    },
    {
      icon: <Key className="w-6 h-6" />,
      title: 'Create Wallet',
      description: 'Create a new wallet or import an existing one',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure Seed Phrase',
      description: 'Write down and safely store your recovery phrase',
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: 'Connect Wallet',
      description: 'Return here and connect your wallet',
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-8">
      <h3 className="font-display text-2xl font-bold mb-6 text-center">
        How to Install <span className="gradient-text">MetaMask</span>
      </h3>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              {step.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">STEP {index + 1}</span>
              </div>
              <h4 className="font-semibold text-lg">{step.title}</h4>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button
          className="btn-gradient px-8 py-3 rounded-xl"
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
        >
          <Download className="w-5 h-5 mr-2" />
          Download MetaMask
        </Button>
      </div>
    </div>
  );
};

export default MetaMaskGuide;
