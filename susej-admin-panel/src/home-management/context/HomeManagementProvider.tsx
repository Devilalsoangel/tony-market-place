"use client";
import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  TopSeller,
  HotDeal,
  FeaturedPost,
  StorefrontBanner,
  HomeSection,
  HomeLayout
} from '@/types/home-management';
import { toast } from "@/components/ui/toast";

export interface HomeManagementState {
  topSellers: TopSeller[];
  hotDeals: HotDeal[];
  featuredPosts: FeaturedPost[];
  storefrontBanners: StorefrontBanner[];
  layout: HomeSection[];
}

export type HomeManagementAction =
  | { type: 'SET_TOP_SELLERS'; payload: TopSeller[] }
  | { type: 'ADD_TOP_SELLER'; payload: TopSeller }
  | { type: 'UPDATE_TOP_SELLER'; payload: { id: string; changes: Partial<TopSeller> } }
  | { type: 'DELETE_TOP_SELLER'; payload: string }
  | { type: 'SET_HOT_DEALS'; payload: HotDeal[] }
  | { type: 'ADD_HOT_DEAL'; payload: HotDeal }
  | { type: 'UPDATE_HOT_DEAL'; payload: { id: string; changes: Partial<HotDeal> } }
  | { type: 'DELETE_HOT_DEAL'; payload: string }
  | { type: 'SET_FEATURED_POSTS'; payload: FeaturedPost[] }
  | { type: 'ADD_FEATURED_POST'; payload: FeaturedPost }
  | { type: 'UPDATE_FEATURED_POST'; payload: { id: string; changes: Partial<FeaturedPost> } }
  | { type: 'DELETE_FEATURED_POST'; payload: string }
  | { type: 'SET_STOREFRONT_BANNERS'; payload: StorefrontBanner[] }
  | { type: 'UPDATE_STOREFRONT_BANNER'; payload: { id: string; changes: Partial<StorefrontBanner> } }
  | { type: 'DELETE_STOREFRONT_BANNER'; payload: string }
  | { type: 'SET_LAYOUT'; payload: HomeSection[] }
  | { type: 'ADD_LAYOUT_ITEM'; payload: HomeSection }
  | { type: 'UPDATE_LAYOUT_ITEM'; payload: { id: string; changes: Partial<HomeSection> } }
  | { type: 'REORDER_LAYOUT'; payload: HomeSection[] };

// Start EMPTY — real rows hydrate from /api/data on mount. No seeded demo
// content flashes before the fetch lands.
const initialState: HomeManagementState = {
  topSellers: [],
  hotDeals: [],
  featuredPosts: [],
  storefrontBanners: [],
  layout: [],
};

function homeManagementReducer(state: HomeManagementState, action: HomeManagementAction): HomeManagementState {
  switch (action.type) {
    case 'SET_TOP_SELLERS':
      return { ...state, topSellers: action.payload };
    case 'ADD_TOP_SELLER':
      return { ...state, topSellers: [...state.topSellers, action.payload] };
    case 'UPDATE_TOP_SELLER':
      return {
        ...state,
        topSellers: state.topSellers.map((seller) =>
          seller.id === action.payload.id
            ? { ...seller, ...action.payload.changes }
            : seller
        ),
      };
    case 'DELETE_TOP_SELLER':
      return {
        ...state,
        topSellers: state.topSellers.filter((seller) => seller.id !== action.payload),
      };
    case 'SET_HOT_DEALS':
      return { ...state, hotDeals: action.payload };
    case 'ADD_HOT_DEAL':
      return { ...state, hotDeals: [...state.hotDeals, action.payload] };
    case 'UPDATE_HOT_DEAL':
      return {
        ...state,
        hotDeals: state.hotDeals.map((deal) =>
          deal.id === action.payload.id ? { ...deal, ...action.payload.changes } : deal
        ),
      };
    case 'DELETE_HOT_DEAL':
      return {
        ...state,
        hotDeals: state.hotDeals.filter((deal) => deal.id !== action.payload),
      };
    case 'SET_FEATURED_POSTS':
      return { ...state, featuredPosts: action.payload };
    case 'ADD_FEATURED_POST':
      return { ...state, featuredPosts: [...state.featuredPosts, action.payload] };
    case 'UPDATE_FEATURED_POST':
      return {
        ...state,
        featuredPosts: state.featuredPosts.map((post) =>
          post.id === action.payload.id
            ? { ...post, ...action.payload.changes }
            : post
        ),
      };
    case 'DELETE_FEATURED_POST':
      return {
        ...state,
        featuredPosts: state.featuredPosts.filter((post) => post.id !== action.payload),
      };
    case 'SET_STOREFRONT_BANNERS':
      return { ...state, storefrontBanners: action.payload };
    case 'UPDATE_STOREFRONT_BANNER':
      return {
        ...state,
        storefrontBanners: state.storefrontBanners.map((banner) =>
          banner.id === action.payload.id
            ? { ...banner, ...action.payload.changes }
            : banner
        ),
      };
    case 'DELETE_STOREFRONT_BANNER':
      return {
        ...state,
        storefrontBanners: state.storefrontBanners.filter((banner) => banner.id !== action.payload),
      };
    case 'SET_LAYOUT':
      return { ...state, layout: action.payload };
    case 'ADD_LAYOUT_ITEM':
      // Upsert by name: the first-toggle create and the adopt-winner path
      // re-dispatch the row with a new isEnabled — replacing keeps the toggle
      // truthful instead of freezing the first-seen state.
      return state.layout.some((s) => s.name === action.payload.name)
        ? { ...state, layout: state.layout.map((s) => (s.name === action.payload.name ? { ...s, ...action.payload } : s)) }
        : { ...state, layout: [...state.layout, action.payload] };
    case 'UPDATE_LAYOUT_ITEM':
      return {
        ...state,
        layout: state.layout.map((section) =>
          section.id === action.payload.id
            ? { ...section, ...action.payload.changes }
            : section
        ),
      };
    case 'REORDER_LAYOUT':
      return { ...state, layout: action.payload };
    default:
      return state;
  }
}

async function api(resource: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown) {
  const res = await fetch(`/api/data/${resource}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return res.json();
}

async function loadRows<T>(resource: string): Promise<T[] | null> {
  try {
    const body = await api(resource);
    return Array.isArray(body?.rows) ? (body.rows as T[]) : null;
  } catch {
    return null;
  }
}

function createHomeManagementActions(dispatch: React.Dispatch<HomeManagementAction>) {
  const fail = (context: string, e: unknown) => {
    console.error(`[home] ${context} failed`, e);
    toast.error(`Couldn't save: ${e instanceof Error ? e.message : "unknown error"}`);
  };

  return {
    setTopSellers: async (sellers: TopSeller[]) => {
      dispatch({ type: "SET_TOP_SELLERS", payload: sellers });
    },
    addTopSeller: async (seller: TopSeller) => {
      try {
        const { row } = await api("top-sellers", "POST", seller);
        dispatch({ type: "ADD_TOP_SELLER", payload: (row ?? seller) as TopSeller });
      } catch (e) {
        fail("addTopSeller", e);
      }
    },
    updateTopSeller: async (id: string, changes: Partial<TopSeller>) => {
      try {
        const { row } = await api("top-sellers", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_TOP_SELLER", payload: { id, changes: (row ?? changes) as Partial<TopSeller> } });
      } catch (e) {
        fail("updateTopSeller", e);
      }
    },
    deleteTopSeller: async (id: string) => {
      try {
        await api("top-sellers", "DELETE", { id });
        dispatch({ type: "DELETE_TOP_SELLER", payload: id });
      } catch (e) {
        fail("deleteTopSeller", e);
      }
    },

    setHotDeals: async (deals: HotDeal[]) => {
      dispatch({ type: "SET_HOT_DEALS", payload: deals });
    },
    addHotDeal: async (deal: HotDeal) => {
      try {
        const { row } = await api("hot-deals", "POST", deal);
        dispatch({ type: "ADD_HOT_DEAL", payload: (row ?? deal) as HotDeal });
      } catch (e) {
        fail("addHotDeal", e);
      }
    },
    updateHotDeal: async (id: string, changes: Partial<HotDeal>) => {
      try {
        const { row } = await api("hot-deals", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_HOT_DEAL", payload: { id, changes: (row ?? changes) as Partial<HotDeal> } });
      } catch (e) {
        fail("updateHotDeal", e);
      }
    },
    deleteHotDeal: async (id: string) => {
      try {
        await api("hot-deals", "DELETE", { id });
        dispatch({ type: "DELETE_HOT_DEAL", payload: id });
      } catch (e) {
        fail("deleteHotDeal", e);
      }
    },

    setFeaturedPosts: async (posts: FeaturedPost[]) => {
      dispatch({ type: "SET_FEATURED_POSTS", payload: posts });
    },
    addFeaturedPost: async (post: FeaturedPost) => {
      try {
        const { row } = await api("featured-posts", "POST", post);
        dispatch({ type: "ADD_FEATURED_POST", payload: (row ?? post) as FeaturedPost });
      } catch (e) {
        fail("addFeaturedPost", e);
      }
    },
    updateFeaturedPost: async (id: string, changes: Partial<FeaturedPost>) => {
      try {
        const { row } = await api("featured-posts", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_FEATURED_POST", payload: { id, changes: (row ?? changes) as Partial<FeaturedPost> } });
      } catch (e) {
        fail("updateFeaturedPost", e);
      }
    },
    deleteFeaturedPost: async (id: string) => {
      try {
        await api("featured-posts", "DELETE", { id });
        dispatch({ type: "DELETE_FEATURED_POST", payload: id });
      } catch (e) {
        fail("deleteFeaturedPost", e);
      }
    },

    updateStorefrontBanner: async (id: string, changes: Partial<StorefrontBanner>) => {
      try {
        const { row } = await api("storefront-banners", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_STOREFRONT_BANNER", payload: { id, changes: (row ?? changes) as Partial<StorefrontBanner> } });
      } catch (e) {
        fail("updateStorefrontBanner", e);
      }
    },
    deleteStorefrontBanner: async (id: string) => {
      try {
        await api("storefront-banners", "DELETE", { id });
        dispatch({ type: "DELETE_STOREFRONT_BANNER", payload: id });
      } catch (e) {
        fail("deleteStorefrontBanner", e);
      }
    },

    setLayout: async (layout: HomeSection[]) => {
      dispatch({ type: "SET_LAYOUT", payload: layout });
    },
    // Fresh prod has zero home-sections rows: flipping a missing section
    // CREATES the row in the chosen state (on or off) instead of dead-ending.
    createLayoutItem: async (name: HomeSection["name"], title: string, isEnabled = true) => {
      try {
        const existing = (await loadRows<HomeSection>("home-sections"))?.find((s) => s.name === name);
        if (existing) {
          if (existing.isEnabled !== isEnabled) {
            try {
              const { row } = await api("home-sections", "PATCH", { id: existing.id, data: { isEnabled } });
              const updated = (row ?? { ...existing, isEnabled }) as HomeSection;
              dispatch({ type: "ADD_LAYOUT_ITEM", payload: updated });
              return updated;
            } catch {
              dispatch({ type: "ADD_LAYOUT_ITEM", payload: existing });
              return existing;
            }
          }
          dispatch({ type: "ADD_LAYOUT_ITEM", payload: existing });
          return existing;
        }
        // HomeSection.id has no DB default (schema): mint a deterministic id
        // from the unique name so first-toggle create succeeds and retries
        // collide on the same row instead of minting duplicates.
        const { row } = await api("home-sections", "POST", { id: `hs-${name}`, name, title, isEnabled, position: 0 });
        const created = (row ?? { id: `hs-${name}`, name, title, isEnabled, position: 0 }) as HomeSection;
        dispatch({ type: "ADD_LAYOUT_ITEM", payload: created });
        return created;
      } catch (e) {
        // Race-close: a concurrent first-toggle already created hs-<name>
        // (P2002 on the deterministic id) — adopt the winner, don't 503.
        try {
          const existing = (await loadRows<HomeSection>("home-sections"))?.find((s) => s.name === name);
          if (existing) {
            dispatch({ type: "ADD_LAYOUT_ITEM", payload: existing });
            return existing;
          }
        } catch {}
        fail("createLayoutItem", e);
        return null;
      }
    },
    updateLayoutItem: async (id: string, changes: Partial<HomeSection>) => {
      try {
        const { row } = await api("home-sections", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_LAYOUT_ITEM", payload: { id, changes: (row ?? changes) as Partial<HomeSection> } });
      } catch (e) {
        fail("updateLayoutItem", e);
      }
    },
    reorderLayout: async (layout: HomeSection[]) => {
      try {
        await Promise.all(
          layout.map((item) => api("home-sections", "PATCH", { id: item.id, data: { position: item.position } }))
        );
        dispatch({ type: "REORDER_LAYOUT", payload: layout });
      } catch (e) {
        fail("reorderLayout", e);
      }
    },
  };
}

export type HomeManagementActions = ReturnType<typeof createHomeManagementActions>;

export const HomeManagementContext = createContext<{
  state: HomeManagementState;
  actions: HomeManagementActions;
}>({
  state: initialState,
  actions: createHomeManagementActions(() => null),
});

export const HomeManagementProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(homeManagementReducer, initialState);
  const [hydrated, setHydrated] = useState(false);

  const actions = createHomeManagementActions(dispatch);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [topSellers, hotDeals, featuredPosts, storefrontBanners, layout] = await Promise.all([
        loadRows<TopSeller>("top-sellers"),
        loadRows<HotDeal>("hot-deals"),
        loadRows<FeaturedPost>("featured-posts"),
        loadRows<StorefrontBanner>("storefront-banners"),
        loadRows<HomeSection>("home-sections"),
      ]);
      if (cancelled) return;
      if (topSellers) dispatch({ type: "SET_TOP_SELLERS", payload: topSellers });
      if (hotDeals) dispatch({ type: "SET_HOT_DEALS", payload: hotDeals });
      if (featuredPosts) dispatch({ type: "SET_FEATURED_POSTS", payload: featuredPosts });
      if (storefrontBanners) dispatch({ type: "SET_STOREFRONT_BANNERS", payload: storefrontBanners });
      if (layout) dispatch({ type: "SET_LAYOUT", payload: layout });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomeManagementContext.Provider value={{ state, actions }}>
      {children}
    </HomeManagementContext.Provider>
  );
};

export const useHomeManagement = () => {
  const context = useContext(HomeManagementContext);
  if (!context) {
    throw new Error('useHomeManagement must be used within a HomeManagementProvider');
  }
  return context;
};