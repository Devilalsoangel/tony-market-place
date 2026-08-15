"use client";
import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  HeroBanner,
  FeaturedCategory,
  TopSeller,
  HotDeal,
  FeaturedPost,
  HomeSection,
  HomeLayout
} from '@/types/home-management';
import { mockHomeData } from '@/home-management/lib/mockData';
import { toast } from "@/components/ui/toast";

export interface HomeManagementState {
  heroBanners: HeroBanner[];
  featuredCategories: FeaturedCategory[];
  topSellers: TopSeller[];
  hotDeals: HotDeal[];
  featuredPosts: FeaturedPost[];
  layout: HomeSection[];
}

export type HomeManagementAction =
  | { type: 'SET_HERO_BANNERS'; payload: HeroBanner[] }
  | { type: 'ADD_HERO_BANNER'; payload: HeroBanner }
  | { type: 'UPDATE_HERO_BANNER'; payload: { id: string; changes: Partial<HeroBanner> } }
  | { type: 'DELETE_HERO_BANNER'; payload: string }
  | { type: 'SET_FEATURED_CATEGORIES'; payload: FeaturedCategory[] }
  | { type: 'ADD_FEATURED_CATEGORY'; payload: FeaturedCategory }
  | { type: 'UPDATE_FEATURED_CATEGORY'; payload: { id: string; changes: Partial<FeaturedCategory> } }
  | { type: 'DELETE_FEATURED_CATEGORY'; payload: string }
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
  | { type: 'SET_LAYOUT'; payload: HomeSection[] }
  | { type: 'UPDATE_LAYOUT_ITEM'; payload: { id: string; changes: Partial<HomeSection> } }
  | { type: 'REORDER_LAYOUT'; payload: HomeSection[] };

const initialState: HomeManagementState = {
  heroBanners: mockHomeData.heroBanners,
  featuredCategories: mockHomeData.featuredCategories,
  topSellers: mockHomeData.topSellers,
  hotDeals: mockHomeData.hotDeals,
  featuredPosts: mockHomeData.featuredPosts,
  layout: mockHomeData.layout,
};

function homeManagementReducer(state: HomeManagementState, action: HomeManagementAction): HomeManagementState {
  switch (action.type) {
    case 'SET_HERO_BANNERS':
      return { ...state, heroBanners: action.payload };
    case 'ADD_HERO_BANNER':
      return { ...state, heroBanners: [...state.heroBanners, action.payload] };
    case 'UPDATE_HERO_BANNER':
      return {
        ...state,
        heroBanners: state.heroBanners.map((banner) =>
          banner.id === action.payload.id ? { ...banner, ...action.payload.changes } : banner
        ),
      };
    case 'DELETE_HERO_BANNER':
      return {
        ...state,
        heroBanners: state.heroBanners.filter((banner) => banner.id !== action.payload),
      };
    case 'SET_FEATURED_CATEGORIES':
      return { ...state, featuredCategories: action.payload };
    case 'ADD_FEATURED_CATEGORY':
      return { ...state, featuredCategories: [...state.featuredCategories, action.payload] };
    case 'UPDATE_FEATURED_CATEGORY':
      return {
        ...state,
        featuredCategories: state.featuredCategories.map((category) =>
          category.id === action.payload.id
            ? { ...category, ...action.payload.changes }
            : category
        ),
      };
    case 'DELETE_FEATURED_CATEGORY':
      return {
        ...state,
        featuredCategories: state.featuredCategories.filter(
          (category) => category.id !== action.payload
        ),
      };
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
    case 'SET_LAYOUT':
      return { ...state, layout: action.payload };
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
    setHeroBanners: async (banners: HeroBanner[]) => {
      dispatch({ type: "SET_HERO_BANNERS", payload: banners });
    },
    addHeroBanner: async (banner: HeroBanner) => {
      try {
        const { row } = await api("hero-banners", "POST", banner);
        dispatch({ type: "ADD_HERO_BANNER", payload: (row ?? banner) as HeroBanner });
      } catch (e) {
        fail("addHeroBanner", e);
      }
    },
    updateHeroBanner: async (id: string, changes: Partial<HeroBanner>) => {
      try {
        const { row } = await api("hero-banners", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_HERO_BANNER", payload: { id, changes: (row ?? changes) as Partial<HeroBanner> } });
      } catch (e) {
        fail("updateHeroBanner", e);
      }
    },
    deleteHeroBanner: async (id: string) => {
      try {
        await api("hero-banners", "DELETE", { id });
        dispatch({ type: "DELETE_HERO_BANNER", payload: id });
      } catch (e) {
        fail("deleteHeroBanner", e);
      }
    },

    setFeaturedCategories: async (categories: FeaturedCategory[]) => {
      dispatch({ type: "SET_FEATURED_CATEGORIES", payload: categories });
    },
    addFeaturedCategory: async (category: FeaturedCategory) => {
      try {
        const { row } = await api("featured-categories", "POST", category);
        dispatch({ type: "ADD_FEATURED_CATEGORY", payload: (row ?? category) as FeaturedCategory });
      } catch (e) {
        fail("addFeaturedCategory", e);
      }
    },
    updateFeaturedCategory: async (id: string, changes: Partial<FeaturedCategory>) => {
      try {
        const { row } = await api("featured-categories", "PATCH", { id, data: changes });
        dispatch({ type: "UPDATE_FEATURED_CATEGORY", payload: { id, changes: (row ?? changes) as Partial<FeaturedCategory> } });
      } catch (e) {
        fail("updateFeaturedCategory", e);
      }
    },
    deleteFeaturedCategory: async (id: string) => {
      try {
        await api("featured-categories", "DELETE", { id });
        dispatch({ type: "DELETE_FEATURED_CATEGORY", payload: id });
      } catch (e) {
        fail("deleteFeaturedCategory", e);
      }
    },

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

    setLayout: async (layout: HomeSection[]) => {
      dispatch({ type: "SET_LAYOUT", payload: layout });
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
      const [heroBanners, featuredCategories, topSellers, hotDeals, featuredPosts, layout] = await Promise.all([
        loadRows<HeroBanner>("hero-banners"),
        loadRows<FeaturedCategory>("featured-categories"),
        loadRows<TopSeller>("top-sellers"),
        loadRows<HotDeal>("hot-deals"),
        loadRows<FeaturedPost>("featured-posts"),
        loadRows<HomeSection>("home-sections"),
      ]);
      if (cancelled) return;
      if (heroBanners) dispatch({ type: "SET_HERO_BANNERS", payload: heroBanners });
      if (featuredCategories) dispatch({ type: "SET_FEATURED_CATEGORIES", payload: featuredCategories });
      if (topSellers) dispatch({ type: "SET_TOP_SELLERS", payload: topSellers });
      if (hotDeals) dispatch({ type: "SET_HOT_DEALS", payload: hotDeals });
      if (featuredPosts) dispatch({ type: "SET_FEATURED_POSTS", payload: featuredPosts });
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