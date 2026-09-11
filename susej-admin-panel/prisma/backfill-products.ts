/** One-time backfill: mirror existing published posts into the Product table. */
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = await getPrisma();
  if (!prisma) throw new Error("no db");
  const posts = await prisma.post.findMany({ where: { status: "published" } });
  let created = 0;
  for (const p of posts) {
    const exists = await prisma.product.findUnique({ where: { id: `lst_${p.id}` } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        id: `lst_${p.id}`,
        title: p.title,
        images: (Array.isArray(p.images) ? p.images : []) as never,
        price: p.price ?? 0,
        category: p.category ?? "",
        sellerName: `${p.authorName}${p.authorUsername ? ` (@${p.authorUsername})` : ""}`,
        status: p.featured ? "featured" : "active",
        reports: 0,
        createdAt: p.createdAt,
      },
    });
    created++;
  }
  console.log(`backfilled ${created}/${posts.length} product mirrors`);
  await prisma.$disconnect();
}
main();
