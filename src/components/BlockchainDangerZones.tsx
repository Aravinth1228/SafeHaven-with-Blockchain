import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Link,
  RefreshCw
} from 'lucide-react';
import { useBlockchainDangerZones } from '@/hooks/useBlockchainDangerZones';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';

interface DangerZoneCardProps {
  zone: {
    id: string;
    blockchainIndex: number;
    zoneId: string;
    name: string;
    lat: number;
    lng: number;
    radius: number;
    level: string;
    createdBy: string;
    createdAt: string;
    isActive: boolean;
  };
  onRemove: (index: number) => void;
  isLoading: boolean;
}

const DangerZoneCard: React.FC<DangerZoneCardProps> = ({ zone, onRemove, isLoading }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Low': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'High': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'Critical': return 'bg-red-600/30 text-red-300 border-red-600/50';
      default: return 'bg-muted';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-lg">{zone.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className="text-xs font-mono">{zone.zoneId}</span>
                {zone.isActive && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${getLevelColor(zone.level)}`}>
            {zone.level}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Coordinates</p>
              <p className="font-mono text-xs">
                {zone.lat.toFixed(6)}, {zone.lng.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Radius</p>
              <p className="font-mono text-xs">{zone.radius} meters</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span className="font-mono">
              Created by: {zone.createdBy.slice(0, 6)}...{zone.createdBy.slice(-4)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link className="w-3 h-3" />
            <a
              href={`https://sepolia.etherscan.io/tx/${zone.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View on Blockchain
            </a>
          </div>

          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Created: {formatDate(zone.createdAt)}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => onRemove(zone.blockchainIndex)}
            disabled={isLoading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove from Blockchain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const BlockchainDangerZones: React.FC = () => {
  const { toast } = useToast();
  const { walletAddress } = useWallet();
  const {
    zones,
    isLoading,
    blockchainStatus,
    checkBlockchainStatus,
    fetchDangerZones,
    createDangerZone,
    removeDangerZone,
  } = useBlockchainDangerZones();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newZone, setNewZone] = useState({
    name: '',
    lat: '',
    lng: '',
    radius: '',
    level: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical'
  });
  const [isRemoving, setIsRemoving] = useState<number | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [zoneToRemove, setZoneToRemove] = useState<number | null>(null);

  useEffect(() => {
    checkBlockchainStatus();
    fetchDangerZones();
  }, [checkBlockchainStatus, fetchDangerZones]);

  const handleCreate = async () => {
    if (!newZone.name || !newZone.lat || !newZone.lng || !newZone.radius) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }

    const result = await createDangerZone({
      name: newZone.name,
      lat: parseFloat(newZone.lat),
      lng: parseFloat(newZone.lng),
      radius: parseFloat(newZone.radius),
      level: newZone.level
    });

    if (result) {
      setNewZone({ name: '', lat: '', lng: '', radius: '', level: 'Medium' });
      setShowAddForm(false);
    }
  };

  const handleRemoveClick = (index: number) => {
    setZoneToRemove(index);
    setShowRemoveDialog(true);
  };

  const handleRemoveConfirm = async () => {
    if (zoneToRemove === null) return;

    const success = await removeDangerZone(zoneToRemove);
    if (success) {
      setShowRemoveDialog(false);
      setZoneToRemove(null);
    }
  };

  if (!blockchainStatus?.initialized) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Blockchain Danger Zones
          </CardTitle>
          <CardDescription>
            Manage danger zones stored on blockchain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mb-4" />
            <h3 className="text-lg font-semibold mb-2">Blockchain Not Connected</h3>
            <p className="text-muted-foreground mb-4">
              Please ensure the blockchain is properly configured and contracts are deployed
            </p>
            <Button onClick={() => checkBlockchainStatus()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Check Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Blockchain Danger Zones
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span className="text-xs">
                  {zones.length} zones on {blockchainStatus.network}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${blockchainStatus.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs"
                >
                  Contract: {blockchainStatus.contractAddress.slice(0, 10)}...
                </a>
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
              disabled={isLoading}
            >
              <Plus className="w-4 h-4" />
              Add Zone
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Add Zone Form */}
      {showAddForm && (
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Add New Danger Zone</CardTitle>
            <CardDescription>
              This zone will be stored on blockchain only (immutable and decentralized)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Zone Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Flood Prone Area"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  placeholder="13.082686"
                  value={newZone.lat}
                  onChange={(e) => setNewZone({ ...newZone, lat: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  placeholder="78.9629"
                  value={newZone.lng}
                  onChange={(e) => setNewZone({ ...newZone, lng: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  placeholder="500"
                  value={newZone.radius}
                  onChange={(e) => setNewZone({ ...newZone, radius: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="level">Danger Level</Label>
                <Select
                  value={newZone.level}
                  onValueChange={(value: any) => setNewZone({ ...newZone, level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleCreate} className="gap-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating on Blockchain...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Zone
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Creating a danger zone on blockchain requires a transaction
                to be submitted. The admin wallet will pay the gas fees. Once created, zones cannot
                be modified, only removed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zones Grid */}
      {isLoading && zones.length === 0 ? (
        <Card className="glass-card border-border/50">
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading zones from blockchain...</span>
            </div>
          </CardContent>
        </Card>
      ) : zones.length === 0 ? (
        <Card className="glass-card border-border/50">
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Danger Zones</h3>
            <p className="text-muted-foreground">
              No danger zones have been created on the blockchain yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <DangerZoneCard
              key={zone.id}
              zone={zone}
              onRemove={handleRemoveClick}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Remove Danger Zone
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the danger zone from the blockchain. This action cannot be undone.
              A blockchain transaction will be submitted using the admin wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Zone
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BlockchainDangerZones;
