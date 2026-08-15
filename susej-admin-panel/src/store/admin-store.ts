import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockAdmins } from "@/services/mock-data";
import type { AdminUser } from "@/types";

interface AdminState {
  admins: AdminUser[];
  addAdmin: (admin: AdminUser) => void;
  updateAdmin: (id: string, data: Partial<AdminUser>) => void;
  removeAdmin: (id: string) => void;
  toggleStatus: (id: string) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      admins: mockAdmins,
      addAdmin: (admin) => set((state) => ({ admins: [...state.admins, admin] })),
      updateAdmin: (id, data) =>
        set((state) => ({
          admins: state.admins.map((a) => (a.id === id ? { ...a, ...data } : a)),
        })),
      removeAdmin: (id) => set((state) => ({ admins: state.admins.filter((a) => a.id !== id) })),
      toggleStatus: (id) =>
        set((state) => ({
          admins: state.admins.map((a) =>
            a.id === id ? { ...a, status: a.status === "active" ? "inactive" : "active" } : a
          ),
        })),
    }),
    {
      name: "susej-admins",
      partialize: (state) => ({ admins: state.admins }),
    }
  )
);
