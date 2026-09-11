import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverApi } from '../utils/serverApi';
import { useAuth } from './AuthContext';

const NOTIFS_KEY_BASE = '@susej_notifications';
const NOTIFS_KEY = NOTIFS_KEY_BASE;

export type NotifType = 'follower' | 'like' | 'comment' | 'bookmark' | 'order' | 'promotion' | 'warning';

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Re-seed per account switch (tokenSeq) so a new login never inherits
  // the previous account's cached notifications.
  const serverSeeded = useRef(-1);

  useEffect(() => {
    const key = user?.username ? `${NOTIFS_KEY_BASE}:${user.username}` : NOTIFS_KEY_BASE;
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const saved = JSON.parse(data) as AppNotification[];
            const real = saved.filter((n) => n && n.id && !/^n\d+$/.test(n.id));
            setNotifications(real.sort((a, b) => b.timestamp - a.timestamp));
          } catch { /* start empty */ }
        } else {
          setNotifications([]);
        }
      })
      .catch(() => { if (!cancelled) setNotifications([]); });
    return () => { cancelled = true; };
  }, [user?.username]);

  // Re-seed per account switch: the server response REPLACES the cached list
  // so a new login never inherits the previous account's notifications.
  useEffect(() => {
    if (!user?.username || serverSeeded.current === tokenSeq) return;
    serverSeeded.current = tokenSeq;
    serverApi.getNotifications().then((res) => {
      if (!res.ok) return;
      const serverRows = (res.data?.notifications ?? [])
        .filter((n: any) => n && n.id)
        .map((n: any) => ({
          id: String(n.id),
          type: ((['follower', 'like', 'comment', 'bookmark', 'order', 'promotion', 'warning'] as string[]).includes(n.type) ? n.type : 'order') as NotifType,
          userName: String(n.title ?? n.userName ?? 'susej'),
          action: String(n.body ?? n.action ?? ''),
          targetId: n.postId ? String(n.postId) : undefined,
          timestamp: typeof n.createdAt === 'string' ? Date.parse(n.createdAt) : Number(n.createdAt ?? Date.now()),
          read: Boolean(n.read),
        }));
      setNotifications([...serverRows].sort((a, b) => b.timestamp - a.timestamp));
    });
  }, [user?.username, tokenSeq]);

  const persist = useCallback((updated: AppNotification[]) => {
    const key = user?.username ? `${NOTIFS_KEY_BASE}:${user.username}` : NOTIFS_KEY_BASE;
    AsyncStorage.setItem(key, JSON.stringify(updated)).catch(() => {});
  }, [user?.username]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      persist(next);
      return next;
    });
    serverApi.markNotificationsRead(id).catch(() => {});
  }, [persist]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persist(next);
      return next;
    });
    // Mirror to server for each unread row
    serverApi.markNotificationsRead('all').catch(() => {});
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
