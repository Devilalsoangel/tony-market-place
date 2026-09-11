import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// App-facing category catalog. The ADMIN PANEL owns categories (name, slug,
// banner image, ordering) - the app renders whatever admins configured here.
// No hardcoded assets on the app side; tiles without a bannerImage render a
// neutral letter tile instead of an injected image.
export async function GET() {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = await prisma.category.findMany({
    where: { status: "active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Full tree in one query — parents need their active children's names so the
  // app can map a parent slug to every listing category under it.
  const childRows = await prisma.category.findMany({
    where: { status: "active", parentId: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });
  const childrenByParent = new Map<string, Array<{ name: string; slug: string }>>();
  for (const ch of childRows) {
    if (!ch.parentId) continue;
    const list = childrenByParent.get(ch.parentId) ?? [];
    list.push({ name: ch.name, slug: ch.slug });
    childrenByParent.set(ch.parentId, list);
  }

  // productCount is COMPUTED from real Product rows (name or slug match) —
  // the stored column is legacy seed residue and must never be echoed.
  let countMap = new Map<string, number>();
  try {
    const counts = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } });
    for (const g of counts) countMap.set(String(g.category).toLowerCase(), g._count._all);
  } catch {
    countMap = new Map();
  }

  return NextResponse.json({
    categories: rows.map((c) => {
      const name = c.name.toLowerCase();
      const slug = c.slug.toLowerCase();
      const computed =
        (countMap.get(name) ?? 0) + (name !== slug ? countMap.get(slug) ?? 0 : 0);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        bannerImage: c.bannerImage || null,
        featured: c.featured,
        productCount: computed,
        children: childrenByParent.get(c.id) ?? [],
      };
    }),
  });
}
