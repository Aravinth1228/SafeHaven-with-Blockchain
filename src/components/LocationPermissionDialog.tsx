import React, { useState, useEffect } from 'react';
import { MapPin, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LocationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrantPermission: () => void;
}

export const LocationPermissionDialog: React.FC<LocationPermissionDialogProps> = ({
  open,
  onOpenChange,
  onGrantPermission,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check current permission state
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        
        result.onchange = () => {
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        };
      });
    }
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setIsRequesting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Location permission granted:', position.coords);
        setPermissionState('granted');
        setIsRequesting(false);
        onGrantPermission();
        onOpenChange(false);
      },
      (error) => {
        console.error('❌ Location permission denied:', error);
        setPermissionState('denied');
        setIsRequesting(false);
        
        if (error.code === error.PERMISSION_DENIED) {
          alert('Location permission was denied. Please enable it in your browser settings.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const getDialogContent = () => {
    switch (permissionState) {
      case 'granted':
        return {
          title: '✅ Location Access Granted',
          description: 'Your location is being tracked for safety.',
          icon: <CheckCircle className="w-12 h-12 text-green-500" />,
        };
      case 'denied':
        return {
          title: '⚠️ Location Access Denied',
          description: 'Please enable location access in your browser settings to use safety tracking features.',
          icon: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
        };
      default:
        return {
          title: '📍 Location Access Required',
          description: 'SafeHaven needs your location to provide real-time safety tracking and emergency alerts.',
          icon: <MapPin className="w-12 h-12 text-primary" />,
        };
    }
  };

  const content = getDialogContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center text-center space-y-4">
            {content.icon}
            <DialogTitle className="text-xl">{content.title}</DialogTitle>
            <DialogDescription className="text-base">
              {content.description}
            </DialogDescription>
          </div>
        </DialogHeader>

        {permissionState === 'denied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>How to enable location access:</strong>
              <br />
              1. Click the lock icon in your browser's address bar
              <br />
              2. Find "Location" in the permissions list
              <br />
              3. Change it to "Allow"
              <br />
              4. Refresh the page
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {permissionState === 'denied' ? (
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1"
            >
              I'll Enable It Later
            </Button>
          ) : permissionState === 'granted' ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Got It
            </Button>
          ) : (
            <>
              <Button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex-1"
              >
                {isRequesting ? 'Requesting...' : 'Enable Location'}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1"
              >
                Later
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
