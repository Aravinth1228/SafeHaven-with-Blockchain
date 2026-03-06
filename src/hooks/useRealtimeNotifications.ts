import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AdminNotification {
    id: string;
    tourist_id: string;
    user_id: string;
    admin_wallet: string;
    message: string;
    notification_type: string;
    read: boolean;
    created_at: string;
}

interface UseRealtimeNotificationsOptions {
    touristId: string;
    enabled?: boolean;
}

export function useRealtimeNotifications({
    touristId,
    enabled = true,
}: UseRealtimeNotificationsOptions) {
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchNotifications = useCallback(async () => {
        if (!enabled || !touristId) return;

        try {
            const result = await api.notifications.getForUser(touristId);
            const data = result.data || [];
            
            setNotifications(data);
            setUnreadCount(data.filter((n: AdminNotification) => !n.read).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [enabled, touristId]);

    useEffect(() => {
        if (!enabled || !touristId) return;

        // Initial fetch
        fetchNotifications();

        // Poll every 5 seconds for new notifications
        const interval = setInterval(fetchNotifications, 5000);

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [enabled, touristId, fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await api.notifications.markRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllRead = async () => {
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;

        try {
            await Promise.all(unread.map(n => api.notifications.markRead(n.id)));
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllRead,
    };
}
