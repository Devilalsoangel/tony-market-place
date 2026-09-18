"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CategoryForm } from "@/components/forms/category-form";
import { useDbResource } from "@/hooks/use-db-resource";
import { Plus, MoreVertical, Copy, Eye, EyeOff, Star, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { Category } from "@/types";

function buildCategoryTree(categories: Category[]): (Category & { children: Category[]; depth: number; orphaned?: boolean })[] {
  const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder;
  const topLevel = categories.filter((c) => !c.parentId).sort(bySort);
  const result: (Category & { children: Category[]; depth: number; orphaned?: boolean })[] = [];
  const seen = new Set<string>();

  function addWithChildren(parent: Category, depth: number) {
    const children = categories.filter((c) => c.parentId === parent.id).sort(bySort);
    result.push({ ...parent, children, depth });
    seen.add(parent.id);
    for (const child of children) {
      addWithChildren(child, depth + 1);
    }
  }

  for (const cat of topLevel) {
    addWithChildren(cat, 0);
  }
  // Orphans (dangling parentId — parent deleted): previously dropped from the
  // tree entirely, invisible in UI while still live in DB/app ordering.
  // Surfaced as depth-0 rows with an Orphaned badge; repair via Edit (parent).
  for (const cat of categories.filter((c) => !seen.has(c.id)).sort(bySort)) {
    result.push({ ...cat, children: [], depth: 0, orphaned: true });
  }
  return result;
}

export default function CategoriesPage() {
  const { data: dbCategories } = useDbResource<Category>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  useEffect(() => {
    if (dbCategories && dbCategories.length > 0) setCategories(dbCategories);
  }, [dbCategories]);

  const apiPatch = (method: string, body: object) =>
    fetch(`/api/data/categories`, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

  // Every mutation below is ok-checked with revert + toast: the old
  // fire-and-forget PATCH/POST/DELETE flashed refused rows, then left them
  // standing silently (paid-rail 403s, has-children 400s).
  async function mutate(label: string, rollback: () => void, request: () => Promise<Response>) {
    try {
      const res = await request();
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${label} failed (${res.status})`);
    } catch (e: unknown) {
      rollback();
      const { toast } = await import("@/components/ui/toast");
      toast.error(e instanceof Error ? e.message : `${label} failed — reverted.`);
    }
  }

  function getChildCount(cat: Category): number {
    return categories.filter((c) => c.parentId === cat.id).length;
  }

  function handleToggle(cat: Category) {
    const status = cat.status === "active" ? "hidden" : "active";
    const prev = categories;
    setCategories((p) =>
      p.map((c) => (c.id === cat.id ? { ...c, status } : c))
    );
    void mutate("Category update", () => setCategories(prev), () => apiPatch("PATCH", { id: cat.id, data: { status } }));
  }

  function handleToggleFeatured(cat: Category) {
    const featured = !cat.featured;
    const prev = categories;
    setCategories((p) =>
      p.map((c) => (c.id === cat.id ? { ...c, featured } : c))
    );
    void mutate("Category update", () => setCategories(prev), () => apiPatch("PATCH", { id: cat.id, data: { featured } }));
  }

  // Reorders within the sibling group, then renumbers the WHOLE tree depth-first
  // (0..N-1) so the app's global `sortOrder asc` ordering matches this table exactly.
  function handleMove(cat: Category, dir: -1 | 1) {
    const key = cat.parentId ?? null;
    const sibs = categories
      .filter((c) => (c.parentId ?? null) === key)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const i = sibs.findIndex((s) => s.id === cat.id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    const swappedPos = new Map(sibs.map((s, idx) => [s.id, idx]));
    const temp = categories.map((c) =>
      swappedPos.has(c.id) ? { ...c, sortOrder: swappedPos.get(c.id)! } : c
    );
    const byParent = new Map<string | null, Category[]>();
    for (const c of temp) {
      const k = c.parentId ?? null;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(c);
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    const positions = new Map<string, number>();
    let n = 0;
    const walk = (parent: string | null) => {
      for (const c of byParent.get(parent) ?? []) {
        positions.set(c.id, n++);
        walk(c.id);
      }
    };
    walk(null);
    const changed: { id: string; sortOrder: number }[] = [];
    const prev = categories;
    const next = temp.map((c) => {
      const pos = positions.get(c.id)!;
      if (pos !== c.sortOrder) changed.push({ id: c.id, sortOrder: pos });
      return { ...c, sortOrder: pos };
    });
    setCategories(next);
    // Any refused reorder reverts the whole tree (partial persistence would
    // fork the desk order from the app's `sortOrder asc` truth).
    void (async () => {
      try {
        for (const u of changed) {
          const res = await apiPatch("PATCH", { id: u.id, data: { sortOrder: u.sortOrder } });
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Reorder failed (${res.status})`);
        }
      } catch (e: unknown) {
        setCategories(prev);
        const { toast } = await import("@/components/ui/toast");
        toast.error(e instanceof Error ? e.message : "Reorder failed — reverted.");
      }
    })();
  }

  function handleSave(data: Partial<Category>) {
    const prev = categories;
    if (editCategory) {
      setCategories((p) =>
        p.map((c) => (c.id === editCategory.id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
      );
      void mutate("Category save", () => setCategories(prev), () => apiPatch("PATCH", { id: editCategory.id, data }));
    } else {
      const maxSort = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        name: data.name || "",
        slug: data.slug || `cat-${Date.now()}`,
        description: data.description || "",
        parentId: data.parentId || null,
        sortOrder: maxSort + 1,
        icon: data.icon || "",
        bannerImage: data.bannerImage || "",
        status: data.status || "active",
        featured: data.featured || false,
        productCount: 0,
        metaTitle: "",
        metaDescription: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCategories((p) => [...p, newCat]);
      void mutate("Category create", () => setCategories(prev), () => apiPatch("POST", newCat));
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const snapshot = categories;
    const idsToRemove = new Set<string>();
    function collectIds(id: string) {
      idsToRemove.add(id);
      snapshot.filter((c) => c.parentId === id).forEach((c) => collectIds(c.id));
    }
    collectIds(deleteTarget.id);
    setCategories((prev) => prev.filter((c) => !idsToRemove.has(c.id)));
    // Server blocks delete when children exist (400): revert + say so (the
    // old handler reverted only the 400 case, silently kept 403/500 ghosts,
    // and used alert()).
    void mutate("Category delete", () => setCategories(snapshot), () => apiPatch("DELETE", { id: deleteTarget.id }));
    setDeleteTarget(null);
  }

  function handleDuplicate(cat: Category) {
    const newCat: Category = {
      ...cat,
      id: `cat_${Date.now()}`,
      name: `${cat.name} (Copy)`,
      slug: `${cat.slug}-copy`,
      productCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const prev = categories;
    setCategories((p) => [...p, newCat]);
    void mutate("Category duplicate", () => setCategories(prev), () => apiPatch("POST", newCat));
  }

  const tree = buildCategoryTree(categories);
  const activeCount = categories.filter((c) => c.status === "active").length;
  const hiddenCount = categories.filter((c) => c.status === "hidden").length;
  const featuredCount = categories.filter((c) => c.featured).length;

  const tabs = [
    { label: "All Categories", value: "all" },
    { label: "Active", value: "active" },
    { label: "Hidden", value: "hidden" },
    { label: "Featured", value: "featured" },
  ];

  function getDisplayData(tab: string) {
    switch (tab) {
      case "active": return tree.filter((c) => c.status === "active");
      case "hidden": return tree.filter((c) => c.status === "hidden");
      case "featured": return tree.filter((c) => c.featured);
      default: return tree;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B] ">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Manage marketplace categories</p>
        </div>
        <Button
          onClick={() => {
            setEditCategory(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-[#18181B] ">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-[#16A34A]">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Hidden</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{hiddenCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 ">
          <p className="text-sm text-gray-500">Featured</p>
          <p className="text-2xl font-bold text-[#6C3BFF]">{featuredCount}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs tabs={tabs} defaultTab="all">
            {(active) => {
              const data = getDisplayData(active);
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E4E4E7] text-left text-sm text-gray-500 ">
                        <th className="pb-3 pl-2 font-medium">Category</th>
                        <th className="pb-3 font-medium">Products <span className="ml-1 rounded-full bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-medium text-[#6C3BFF]">auto</span></th>
                        <th className="pb-3 font-medium">Order</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="w-12 pb-3 font-medium"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((cat) => (
                        <tr
                          key={cat.id}
                          className="border-b border-[#E4E4E7] transition-colors hover:bg-gray-50  "
                        >
                          <td className="py-3 pl-2">
                            <div className="flex items-center gap-2" style={{ paddingLeft: `${cat.depth * 24}px` }}>
                              {cat.depth > 0 && (
                                <div className="h-px w-4 bg-gray-300 " />
                              )}
                              <div>
                                <p className="text-sm font-medium text-[#18181B] ">
                                  {cat.name}
                                </p>
                                <p className="text-xs text-gray-400">/{cat.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="text-sm text-gray-700">{cat.productCount.toLocaleString()}</span>
                            <span className="ml-2 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]" title="Live count from Product table groupBy — not manually editable">live</span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <button
                                title="Move up"
                                aria-label={`Move ${cat.name} up`}
                                onClick={() => handleMove(cat, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                title="Move down"
                                aria-label={`Move ${cat.name} down`}
                                onClick={() => handleMove(cat, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge variant={cat.status === "active" ? "success" : "default"}>
                              {cat.status}
                            </Badge>
                            {cat.orphaned && (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-medium text-[#92400E]" title="Parent category is gone — Edit to re-parent or move to top level">
                                <AlertTriangle className="h-3 w-3" /> Orphaned
                              </span>
                            )}
                          </td>
                          <td className="w-12 py-3" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu
                              trigger={
                                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 ">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              }
                              align="end"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditCategory(cat);
                                  setFormOpen(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(cat)}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleFeatured(cat)}>
                                <Star className={`mr-2 h-3.5 w-3.5 ${cat.featured ? "fill-[#F59E0B] text-[#F59E0B]" : ""}`} />
                                {cat.featured ? "Unfeature" : "Feature"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(cat)}>
                                {cat.status === "active" ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                                {cat.status === "active" ? "Hide" : "Show"}
                              </DropdownMenuItem>
                              <DropdownMenuItem danger onClick={() => setDeleteTarget(cat)}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }}
          </Tabs>
        </CardContent>
      </Card>

      <CategoryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        editCategory={editCategory}
        categories={categories}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444]" />
          <h3 className="mt-3 text-lg font-semibold text-[#18181B] ">Delete Category</h3>
          <p className="mt-2 text-sm text-gray-500">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          {deleteTarget && getChildCount(deleteTarget) > 0 && (
            <p className="mt-2 text-sm text-[#F59E0B]">
              This will also delete {getChildCount(deleteTarget)} sub-categor{getChildCount(deleteTarget) > 1 ? "ies" : "y"}.
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
