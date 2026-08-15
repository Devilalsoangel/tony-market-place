import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFS_KEY = '@susej_notifications';

export type NotifType = 'follower' | 'like' | 'comment' | 'bookmark' | 'order' | 'promotion';

export interface AppNotification {
  id: string;
  type: NotifType;
  userName: string;
  userHandle?: string;
  action: string;
  target?: string;
  targetId?: string;
  timestamp: number;
  read: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', type: 'follower', userName: 'Sarah Qureshi', action: 'followed you', targetId: 'sarah_qureshi', timestamp: Date.now() - 60000 * 5, read: false },
  { id: 'n2', type: 'like', userName: 'Ananya Sharma', action: 'liked your Vintage Silk Saree', target: 'post_001', targetId: 'post_001', timestamp: Date.now() - 60000 * 30, read: false },
  { id: 'n3', type: 'comment', userName: 'Raj Patel', action: 'commented: "Beautiful piece!"', target: 'post_001', targetId: 'post_001', timestamp: Date.now() - 60000 * 90, read: false },
  { id: 'n4', type: 'order', userName: 'Priya Singh', action: 'ordered Vintage Silk Saree', target: 'post_001', targetId: 'post_001', timestamp: Date.now() - 3600000 * 2, read: false },
  { id: 'n5', type: 'bookmark', userName: 'Maya Gupta', action: 'saved your Handmade Vase to "Home Decor"', targetId: 'post_001', timestamp: Date.now() - 3600000 * 4, read: true },
  { id: 'n6', type: 'like', userName: 'Vikram Rao', action: 'liked your Retro Denim Jacket', target: 'post_003', targetId: 'post_003', timestamp: Date.now() - 3600000 * 9, read: true },
  { id: 'n7', type: 'promotion', userName: 'New Season Sale', action: 'Up to 50% off — explore the latest drops near you', targetId: 'promo_1', timestamp: Date.now() - 3600000 * 26, read: true },
  { id: 'n8', type: 'order', userName: 'Luxe Thread Co', action: 'shipped your order', target: 'Wireless Earbuds', targetId: 'post_002', timestamp: Date.now() - 60000 * 15, read: false },
  { id: 'n9', type: 'order', userName: 'Urban Threads', action: 'is out for delivery — arriving today', target: 'Retro Denim Jacket', targetId: 'post_003', timestamp: Date.now() - 60000 * 75, read: false },
  { id: 'n10', type: 'order', userName: 'Velvet & Co', action: 'delivered your order', target: 'Embroidered Kimono', targetId: 'post_001', timestamp: Date.now() - 3600000 * 5, read: false },
  { id: 'n11', type: 'order', userName: 'susej', action: 'would love a review of your recent order', target: 'Handmade Ceramic Vase', targetId: 'post_001', timestamp: Date.now() - 3600000 * 8, read: false },
  { id: 'n12', type: 'promotion', userName: 'Price Drop Alert', action: 'Vintage Silk Saree is now ₹4,999 — was ₹6,250', target: 'post_001', targetId: 'post_001', timestamp: Date.now() - 3600000 * 12, read: false },
  { id: 'n13', type: 'like', userName: 'Ishaan Verma', action: 'liked your Handmade Ceramic Vase', target: 'post_001', targetId: 'post_001', timestamp: Date.now() - 3600000 * 15, read: false },
  { id: 'n14', type: 'comment', userName: 'Neha Kapoor', action: 'commented: "How do I order this?"', target: 'post_002', targetId: 'post_002', timestamp: Date.now() - 3600000 * 20, read: true },
  { id: 'n15', type: 'promotion', userName: 'Price Drop alert', action: 'Wireless Earbuds now ₹999 — down from ₹1,499', target: 'post_002', targetId: 'post_002', timestamp: Date.now() - 3600000 * 48, read: true },
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFS_KEY)
      .then((data) => {
        if (data) {
          try {
            const saved = JSON.parse(data) as AppNotification[];
            const merged = new Map<string, AppNotification>();
            for (const n of SEED_NOTIFICATIONS) merged.set(n.id, n);
            for (const n of saved) {
              // Persisted data never wins over seeds on TIMESTAMP — seeds stay fresh
              // (otherwise "5d ago" data persists forever after a stale run).
              const seed = SEED_NOTIFICATIONS.find((s) => s.id === n.id);
              merged.set(n.id, { ...merged.get(n.id), ...n, timestamp: seed ? seed.timestamp : n.timestamp });
            }
            setNotifications(Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp));
          } catch { /* use seeds */ }
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((updated: AppNotification[]) => {
    AsyncStorage.setItem(NOTIFS_KEY, JSON.stringify(updated)).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      persist(next);
      return next;
    });
  }, [persist]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persist(next);
      return next;
    });
  }, [persist]);

  const addNotification = useCallback((input: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...input,
      id: `n_${Date.now()}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => {
      const next = [newNotif, ...prev];
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
