import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { serverApi } from '../utils/serverApi';
import { useAuth } from './AuthContext';

const COMMUNITIES_KEY_BASE = '@susej_communities';
const MESSAGES_KEY_BASE = '@susej_community_messages';

export interface CommunityMember {
  username: string;
  name: string;
  avatar?: string | null;
  verified?: boolean;
}

export interface Community {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  joined: boolean;
  description?: string;
  rules?: string;
  ownerName?: string;
  members?: CommunityMember[];
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  author: string;
  authorUsername: string;
  text: string;
  createdAt: number;
}

interface CommunityContextType {
  communities: Community[];
  joinedCommunities: Community[];
  join: (id: string) => void;
  leave: (id: string) => void;
  toggleJoin: (id: string) => void;
  addCommunity: (community: Community) => void;
  messagesFor: (communityId: string) => CommunityMessage[];
  sendMessage: (communityId: string, text: string) => void;
}

const CommunityContext = createContext<CommunityContextType | null>(null);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user, tokenSeq } = useAuth();
  const username = user?.username ?? null;
  const communitiesKey = username ? `${COMMUNITIES_KEY_BASE}:${username}` : COMMUNITIES_KEY_BASE;
  const messagesKey = username ? `${MESSAGES_KEY_BASE}:${username}` : MESSAGES_KEY_BASE;
  // Real data only: starts empty, populated from the shared backend (the same
  // rows the admin panel moderates) plus communities the user creates locally.
  const [communities, setCommunities] = useState<Community[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  // Re-discover per account switch (tokenSeq), mirroring PostContext.
  const serverSeeded = useRef(-1);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(communitiesKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const saved = JSON.parse(data) as Community[];
            // Drop legacy demo seeds (comm_* ids with fabricated member counts).
            const real = saved.filter((c) => c && c.id && !String(c.id).startsWith('comm_'));
            setCommunities(real);
          } catch {}
        } else {
          setCommunities([]);
        }
      })
      .catch(() => { if (!cancelled) setCommunities([]); });
    return () => { cancelled = true; };
  }, [communitiesKey]);

  // Merge the shared backend's real communities (admin-managed, same rows the
  // admin panel moderates) into the discovery list once per login.
  useEffect(() => {
    if (!user?.username || serverSeeded.current === tokenSeq) return;
    serverSeeded.current = tokenSeq;
    serverApi.getCommunities().then((res) => {
      if (!res.ok || !res.data?.communities?.length) return;
      const serverRows = res.data.communities
        .filter((c: any) => c && c.id)
        .map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? 'Community'),
          category: String(c.category ?? 'General'),
          memberCount: Number(c.memberCount ?? 0),
          joined: Boolean(c.joined),
          description: c.description ? String(c.description) : undefined,
          ownerName: c.ownerName ? String(c.ownerName) : undefined,
          members: Array.isArray(c.memberProfiles)
            ? (c.memberProfiles as any[])
                .filter((m) => m && m.username)
                .map((m) => ({
                  username: String(m.username),
                  name: String(m.name || m.username),
                  avatar: typeof m.avatar === 'string' ? m.avatar : null,
                  verified: Boolean(m.verified),
                }))
            : undefined,
        }));
      setCommunities((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        let changed = false;
        const merged = prev.map((p) => {
          const srv = serverRows.find((s: any) => s.id === p.id);
          if (!srv) return p;
          if (
            p.joined !== srv.joined ||
            p.memberCount !== srv.memberCount ||
            JSON.stringify(p.members ?? null) !== JSON.stringify(srv.members ?? null) ||
            p.ownerName !== srv.ownerName
          ) {
            changed = true;
            return { ...p, joined: srv.joined, memberCount: srv.memberCount, members: srv.members, ownerName: srv.ownerName };
          }
          return p;
        });
        const known = new Set(prev.map((p) => p.id));
        const fresh = serverRows.filter((sc) => !known.has(sc.id));
        if (fresh.length) return [...merged, ...fresh];
        return changed ? merged : prev;
      });
    });
  }, [user?.username, tokenSeq]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(messagesKey)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          try {
            const saved = JSON.parse(data) as CommunityMessage[];
            // Drop legacy seed chatter (msg_1..3 from fake users).
            const real = saved.filter((m) => m && m.id && !/^msg_[123]$/.test(String(m.id)));
            setMessages(real);
          } catch {}
        } else {
          setMessages([]);
        }
      })
      .catch(() => { if (!cancelled) setMessages([]); });
    return () => { cancelled = true; };
  }, [messagesKey]);

  const persist = useCallback((next: Community[]) => {
    AsyncStorage.setItem(communitiesKey, JSON.stringify(next)).catch(() => {});
  }, [communitiesKey]);

  const setJoined = useCallback(
    (id: string, joined: boolean) => {
      let snapJoined: boolean | null = null;
      let snapCount = 0;
      let didChange = false;
      setCommunities((prev) => {
        const target = prev.find((c) => c.id === id);
        if (target) {
          snapJoined = target.joined;
          snapCount = target.memberCount;
          didChange = target.joined !== joined;
        } else {
          snapJoined = !joined;
          snapCount = 0;
          didChange = true;
        }
        if (!didChange) return prev;
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            joined,
            memberCount: joined ? c.memberCount + 1 : Math.max(0, c.memberCount - 1),
          };
        });
        persist(next);
        return next;
      });
      // Mirror to server; on failure rollback to snapshot captured above.
      void serverApi.toggleCommunityJoin?.(id, joined).catch(() => {
        if (!didChange) return;
        setCommunities((prev) => {
          const rollback = prev.map((c) =>
            c.id === id ? { ...c, joined: !!snapJoined, memberCount: snapCount } : c
          );
          persist(rollback);
          return rollback;
        });
      });
    },
    [persist]
  );

  const join = useCallback((id: string) => setJoined(id, true), [setJoined]);
  const leave = useCallback((id: string) => setJoined(id, false), [setJoined]);

  const addCommunity = useCallback(
    (community: Community) => {
      const tempId = community.id;
      // Optimistic local row first (instant UI), then the shared server row —
      // creations used to live on this device only, invisible to everyone else.
      setCommunities((prev) => {
        const next = [{ ...community, joined: true }, ...prev];
        persist(next);
        return next;
      });
      void serverApi
        .createCommunity({ name: community.name, description: community.description })
        .then((res) => {
          const s = res.ok ? res.data?.community : null;
          if (!s?.id) return; // offline: local-only row stays (documented fallback)
          setCommunities((prev) => {
            const next = prev.map((c) =>
              c.id === tempId
                ? {
                    ...c,
                    id: String(s.id),
                    name: String(s.name ?? c.name),
                    description: typeof s.description === 'string' ? s.description : c.description,
                    memberCount: Number(s.memberCount ?? 1),
                    joined: true,
                  }
                : c
            );
            persist(next);
            return next;
          });
        })
        .catch(() => {});
    },
    [persist]
  );

  const toggleJoin = useCallback(
    (id: string) => {
      const target = communities.find((c) => c.id === id);
      const nextJoined = target ? !target.joined : true;
      setJoined(id, nextJoined);
    },
    [communities, setJoined]
  );

  const joinedCommunities = communities.filter((c) => c.joined);

  const messagesFor = useCallback(
    (communityId: string) =>
      messages
        .filter((m) => m.communityId === communityId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [messages]
  );

  const sendMessage = useCallback(
    (communityId: string, text: string) => {
      if (!text.trim()) return;
      const authorUsername = username ?? 'you';
      const author = user?.name ?? 'You';
      const message: CommunityMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        communityId,
        author,
        authorUsername,
        text,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, message];
        AsyncStorage.setItem(messagesKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // Real message on the shared backend for server communities.
      serverApi.sendCommunityMessage(communityId, text).catch(() => {});
    },
    [username, user?.name, messagesKey]
  );

  return (
    <CommunityContext.Provider
      value={{ communities, joinedCommunities, join, leave, toggleJoin, addCommunity, messagesFor, sendMessage }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunities() {
  const ctx = useContext(CommunityContext);
  if (!ctx) {
    throw new Error('useCommunities must be used within a CommunityProvider');
  }
  return ctx;
}
