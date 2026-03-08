import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface Profile {
  id?: string;
  user_id: string;
  tourist_id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  wallet_address?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface UseRealtimeProfilesOptions {
  onNewProfile?: (profile: Profile) => void;
  onProfileUpdated?: (profile: Profile) => void;
  onProfileDeleted?: (profile: Profile) => void;
  enabled?: boolean;
}

export function useRealtimeProfiles({
  onNewProfile,
  onProfileUpdated,
  onProfileDeleted,
  enabled = true,
}: UseRealtimeProfilesOptions) {
  const prevProfilesRef = useRef<Map<string, Profile>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data } = await api.users.getAll();
      const currentProfiles = new Map<string, Profile>();
      data.forEach((profile: Profile) => currentProfiles.set(profile.user_id, profile));

      // Check for new profiles
      currentProfiles.forEach((profile, userId) => {
        if (!prevProfilesRef.current.has(userId)) {
          console.log('New profile registered:', profile.username);
          onNewProfile?.(profile);
        } else {
          const prevProfile = prevProfilesRef.current.get(userId);
          if (prevProfile?.status !== profile.status || prevProfile?.updated_at !== profile.updated_at) {
            console.log('Profile updated:', profile.username, 'Status:', profile.status);
            onProfileUpdated?.(profile);
          }
        }
      });

      // Check for deleted profiles
      prevProfilesRef.current.forEach((prevProfile, userId) => {
        if (!currentProfiles.has(userId)) {
          console.log('Profile deleted:', prevProfile.username);
          onProfileDeleted?.(prevProfile);
        }
      });

      prevProfilesRef.current = currentProfiles;
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }, [onNewProfile, onProfileUpdated, onProfileDeleted]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchProfiles();

    // Poll every 2 seconds for profile changes (faster real-time updates)
    pollIntervalRef.current = setInterval(fetchProfiles, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enabled, fetchProfiles]);

  return {
    refresh: fetchProfiles,
  };
}
