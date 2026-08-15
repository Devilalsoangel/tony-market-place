import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COMMUNITIES_KEY = '@susej_communities';
const MESSAGES_KEY = '@susej_community_messages';

export interface Community {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  joined: boolean;
  description?: string;
  rules?: string;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  author: string;
  authorUsername: string;
  text: string;
  createdAt: number;
}

const SEED_COMMUNITIES: Community[] = [
  { id: 'comm_fashion', name: 'Fashion Enthusiasts', category: 'Fashion', memberCount: 12480, joined: true, description: 'Trends, thrift finds, and fashion resale talk.' },
  { id: 'comm_electronics', name: 'Gadget Geeks', category: 'Electronics', memberCount: 9321, joined: true, description: 'Deals, reviews, and tech resale.' },
  { id: 'comm_home', name: 'Home & Living', category: 'Home Services', memberCount: 6042, joined: false, description: 'Interior inspo, decor swaps, and home services.' },
  { id: 'comm_pets', name: 'Pet Parents', category: 'Pets', memberCount: 8110, joined: false, description: 'Pet supplies, grooming services, and adoption.' },
  { id: 'comm_food', name: 'Local Foodies', category: 'Groceries', memberCount: 15320, joined: false, description: 'Home kitchens, groceries, and neighborhood eats.' },
  { id: 'comm_crafts', name: 'Art & Crafts Circle', category: 'Art & Crafts', memberCount: 3544, joined: false, description: 'Handmade goods and maker meetups.' },
];

const SEED_MESSAGES: CommunityMessage[] = [
  { id: 'msg_1', communityId: 'comm_fashion', author: 'Elara M.', authorUsername: 'elara_mod', text: 'Welcome to Fashion Enthusiasts! Share your latest finds.', createdAt: Date.now() - 86400000 },
  { id: 'msg_2', communityId: 'comm_fashion', author: 'Ravi K.', authorUsername: 'ravi', text: 'Just scored a vintage jacket on the feed — highly recommend the seller!', createdAt: Date.now() - 3600000 },
  { id: 'msg_3', communityId: 'comm_electronics', author: 'Sara T.', authorUsername: 'sara', text: 'Any recommendations for a budget laptop under 40k?', createdAt: Date.now() - 7200000 },
];

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
  const [communities, setCommunities] = useState<Community[]>(SEED_COMMUNITIES);
  const [messages, setMessages] = useState<CommunityMessage[]>(SEED_MESSAGES);

  useEffect(() => {
    AsyncStorage.getItem(COMMUNITIES_KEY)
      .then((data) => {
        if (data) {
          try {
            const saved = JSON.parse(data) as Community[];
            const merged = new Map<string, Community>();
            for (const c of SEED_COMMUNITIES) merged.set(c.id, c);
            for (const c of saved) merged.set(c.id, { ...merged.get(c.id), ...c });
            setCommunities(Array.from(merged.values()));
          } catch {
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(MESSAGES_KEY)
      .then((data) => {
        if (data) {
          try {
            const saved = JSON.parse(data) as CommunityMessage[];
            const merged = new Map<string, CommunityMessage>();
            for (const m of SEED_MESSAGES) merged.set(m.id, m);
            for (const m of saved) merged.set(m.id, m);
            setMessages(Array.from(merged.values()));
          } catch {
          }
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: Community[]) => {
    AsyncStorage.setItem(COMMUNITIES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setJoined = useCallback(
    (id: string, joined: boolean) => {
      setCommunities((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id || c.joined === joined) return c;
          return {
            ...c,
            joined,
            memberCount: joined ? c.memberCount + 1 : Math.max(0, c.memberCount - 1),
          };
        });
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const join = useCallback((id: string) => setJoined(id, true), [setJoined]);
  const leave = useCallback((id: string) => setJoined(id, false), [setJoined]);

  const addCommunity = useCallback(
    (community: Community) => {
      setCommunities((prev) => {
        const next = [{ ...community, joined: true }, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleJoin = useCallback(
    (id: string) => {
      setCommunities((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c;
          const joined = !c.joined;
          return {
            ...c,
            joined,
            memberCount: joined ? c.memberCount + 1 : Math.max(0, c.memberCount - 1),
          };
        });
        persist(next);
        return next;
      });
    },
    [persist]
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
      const message: CommunityMessage = {
        id: `msg_${Date.now()}`,
        communityId,
        author: 'You',
        authorUsername: 'you',
        text,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, message];
        AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
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
