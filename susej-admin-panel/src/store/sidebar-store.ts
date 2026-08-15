import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openModules: string[];
  toggleModule: (id: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      openModules: ["commerce", "people", "finance"],
      toggleModule: (id) =>
        set((state) => ({
          openModules: state.openModules.includes(id)
            ? state.openModules.filter((m) => m !== id)
            : [...state.openModules, id],
        })),
    }),
    {
      name: "susej-sidebar",
      partialize: (state) => ({ collapsed: state.collapsed, openModules: state.openModules }),
    }
  )
);
