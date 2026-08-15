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
import { Plus, MoreVertical, Copy, Eye, EyeOff, Star, AlertTriangle } from "lucide-react";
import type { Category } from "@/types";

function buildCategoryTree(categories: Category[]): (Category & { children: Category[]; depth: number })[] {
  const topLevel = categories.filter((c) => !c.parentId);
  const result: (Category & { children: Category[]; depth: number })[] = [];

  function addWithChildren(parent: Category, depth: number) {
    const children = categories.filter((c) => c.parentId === parent.id);
    result.push({ ...parent, children, depth });
    for (const child of children) {
      addWithChildren(child, depth + 1);
    }
  }

  for (const cat of topLevel) {
    addWithChildren(cat, 0);
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
      body: JSON.stringify(body),
    });

  function getChildCount(cat: Category): number {
    return categories.filter((c) => c.parentId === cat.id).length;
  }

  function handleToggle(cat: Category) {
    const status = cat.status === "active" ? "hidden" : "active";
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, status } : c))
    );
    apiPatch("PATCH", { id: cat.id, data: { status } });
  }

  function handleToggleFeatured(cat: Category) {
    const featured = !cat.featured;
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, featured } : c))
    );
    apiPatch("PATCH", { id: cat.id, data: { featured } });
  }

  function handleSave(data: Partial<Category>) {
    if (editCategory) {
      setCategories((prev) =>
        prev.map((c) => (c.id === editCategory.id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
      );
      apiPatch("PATCH", { id: editCategory.id, data });
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}`,
        name: data.name || "",
        slug: data.slug || `cat-${Date.now()}`,
        description: data.description || "",
        parentId: data.parentId || null,
        sortOrder: 0,
        icon: data.icon || "ðŸ“",
        bannerImage: data.bannerImage || "",
        status: data.status || "active",
        featured: data.featured || false,
        productCount: 0,
        metaTitle: "",
        metaDescription: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, newCat]);
      apiPatch("POST", newCat);
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const idsToRemove = new Set<string>();
    function collectIds(id: string) {
      idsToRemove.add(id);
      categories.filter((c) => c.parentId === id).forEach((c) => collectIds(c.id));
    }
    collectIds(deleteTarget.id);
    setCategories((prev) => prev.filter((c) => !idsToRemove.has(c.id)));
    apiPatch("DELETE", { id: deleteTarget.id });
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
    setCategories((prev) => [...prev, newCat]);
    apiPatch("POST", newCat);
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
                        <th className="pb-3 font-medium">Products</th>
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
                          <td className="py-3 text-sm text-gray-500">{cat.productCount.toLocaleString()}</td>
                          <td className="py-3">
                            <Badge variant={cat.status === "active" ? "success" : "default"}>
                              {cat.status}
                            </Badge>
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
