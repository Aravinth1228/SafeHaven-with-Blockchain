import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import BlockchainDangerZones from '@/components/BlockchainDangerZones';

const BlockchainDangerZonesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/admin-dashboard')}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold">
                Blockchain <span className="gradient-text">Danger Zones</span>
              </h1>
              <p className="text-muted-foreground text-sm">
                Manage danger zones stored on blockchain (immutable & decentralized)
              </p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="glass-card rounded-xl p-4 mb-6 border-primary/30">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Blockchain-Only Storage</h3>
              <p className="text-sm text-muted-foreground">
                Danger zones created here are stored <strong>only on the blockchain</strong>, not in MongoDB.
                This ensures immutability, transparency, and decentralization. Admin wallet pays gas fees for transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Blockchain Danger Zones Component */}
        <BlockchainDangerZones />
      </div>
    </div>
  );
};

export default BlockchainDangerZonesPage;
