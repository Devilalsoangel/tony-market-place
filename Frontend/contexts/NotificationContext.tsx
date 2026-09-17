import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverApi } from '../utils/serverApi';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

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
  /** Pull older rows (server cursor). No-op while push is off. */
  loadMore: () => void;
  hasMore: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const { settings } = useSettings();
  // Push toggle is HONORED (was theater): off means no server pulls, no local
  // mints, no badge. The saved list stays readable with an explanatory note.
  const pushOn = settings.pushNotifications !== false;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  // Re-seed per account switch (tokenSeq) so a new login never inherits
  // the previous account's cached notifications.
  const serverSeeded = useRef<string | null>(null);

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
  // Skipped while push is off (no silent fetching behind a disabled toggle).
  useEffect(() => {
    if (!user?.username) return;
    // Seed key includes the push flag: toggling push back ON refetches.
    const seedKey = `${tokenSeq}:${pushOn ? 1 : 0}`;
    if (serverSeeded.current === seedKey) return;
    serverSeeded.current = seedKey;
    if (!pushOn) return;
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
      setHasMore(serverRows.length >= 100);
    });
  }, [user?.username, tokenSeq, pushOn]);

  const persist = useCallback((updated: AppNotification[]) => {
    const key = user?.username ? `${NOTIFS_KEY_BASE}:${user.username}` : NOTIFS_KEY_BASE;
    AsyncStorage.setItem(key, JSON.stringify(updated)).catch(() => {});
  }, [user?.username]);

  const unreadCount = pushOn ? notifications.filter((n) => !n.read).length : 0;

  const refreshFromServer = useCallback(() => {
    serverApi.getNotifications().then((res) => {
      if (!res.ok) return;
      const serverRows = ((res.data?.notifications ?? []) as any[])
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
      setHasMore(serverRows.length >= 100);
    }).catch(() => {});
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      persist(next);
      return next;
    });
    // Rollback-by-refetch: an offline tap faked read locally while the server
    // stayed unread (resurrected on next re-seed). Failure re-pulls truth.
    serverApi.markNotificationsRead(id).then((res) => {
      if (!res.ok) refreshFromServer();
    }).catch(() => refreshFromServer());
  }, [persist, refreshFromServer]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persist(next);
      return next;
    });
    // Mirror to server for each unread row
    serverApi.markNotificationsRead('all').then((res) => {
      if (!res.ok) refreshFromServer();
    }).catch(() => refreshFromServer());
  }, [persist, refreshFromServer]);

  const loadMore = useCallback(() => {
    if (!pushOn || notifications.length === 0) return;
    const oldest = Math.min(...notifications.map((n) => n.timestamp));
    if (!Number.isFinite(oldest)) return;
    serverApi.getNotifications(oldest).then((res) => {
      if (!res.ok) return;
      const rows = ((res.data?.notifications ?? []) as any[])
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
      setNotifications((prev) => {
        const known = new Set(prev.map((p) => p.id));
        const next = [...prev, ...rows.filter((r) => !known.has(r.id))].sort((a, b) => b.timestamp - a.timestamp);
        persist(next);
        return next;
      });
      setHasMore(rows.length >= 100);
    }).catch(() => {});
  }, [pushOn, notifications, persist]);

  const addNotification = useCallback((input: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    // Gated by the push toggle like everything else in this provider.
    if (!pushOn) return;
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
  }, [persist, pushOn]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification, loadMore, hasMore }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
