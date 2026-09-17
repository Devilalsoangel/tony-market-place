import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

/**
 * GET /api/app/addresses — the caller's OWN address book (cross-device truth).
 * The app used to keep addresses in per-device AsyncStorage only — reinstall
 * or second device lost them (Amazon must-have). Server rows are truth;
 * the device cache is an offline mirror.
 */
export async function GET(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = String(auth.user.username ?? "").trim();
  if (!username) return NextResponse.json({ addresses: [] });

  const rows = await prisma.addressBookEntry.findMany({
    where: { userName: username },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    take: 20,
  });
  return NextResponse.json({
    addresses: rows.map((r) => ({
      id: r.id,
      type: r.label,
      name: username,
      street: r.address,
      city: r.city,
      phone: r.phone,
      isDefault: r.isDefault,
    })),
  });
}

function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

/**
 * POST /api/app/addresses — add one entry (max 20). First entry becomes
 * default automatically; pass isDefault:true to move the default.
 */
export async function POST(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = String(auth.user.username ?? "").trim();
  if (!username) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { type?: string; street?: string; city?: string; phone?: string; isDefault?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const label = clean(body.type, 20) || "Home";
  const address = clean(body.street, 300);
  const city = clean(body.city, 100);
  const phone = clean(body.phone, 20).replace(/[^\d+]/g, "");
  if (!address || !city || phone.length < 7) {
    return NextResponse.json({ error: "street, city and a valid phone are required" }, { status: 400 });
  }

  const count = await prisma.addressBookEntry.count({ where: { userName: username } });
  if (count >= 20) return NextResponse.json({ error: "Address book full (max 20)" }, { status: 400 });

  const makeDefault = body.isDefault === true || count === 0;
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.addressBookEntry.updateMany({ where: { userName: username }, data: { isDefault: false } });
    }
    return tx.addressBookEntry.create({
      data: { userName: username, label, address, city, phone, isDefault: makeDefault },
    });
  });
  return NextResponse.json({
    address: {
      id: created.id,
      type: created.label,
      name: username,
      street: created.address,
      city: created.city,
      phone: created.phone,
      isDefault: created.isDefault,
    },
  });
}

/**
 * PATCH /api/app/addresses — edit one entry or move the default. Owner-only.
 */
export async function PATCH(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = String(auth.user.username ?? "").trim();
  let body: { id?: string; type?: string; street?: string; city?: string; phone?: string; isDefault?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const id = clean(body.id, 50);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.addressBookEntry.findUnique({ where: { id } });
  if (!existing || existing.userName !== username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const data: { label?: string; address?: string; city?: string; phone?: string; isDefault?: boolean } = {};
  if (body.type !== undefined) data.label = clean(body.type, 20) || existing.label;
  if (body.street !== undefined) {
    const s = clean(body.street, 300);
    if (!s) return NextResponse.json({ error: "street cannot be empty" }, { status: 400 });
    data.address = s;
  }
  if (body.city !== undefined) {
    const c = clean(body.city, 100);
    if (!c) return NextResponse.json({ error: "city cannot be empty" }, { status: 400 });
    data.city = c;
  }
  if (body.phone !== undefined) {
    const p = clean(body.phone, 20).replace(/[^\d+]/g, "");
    if (p.length < 7) return NextResponse.json({ error: "invalid phone" }, { status: 400 });
    data.phone = p;
  }
  if (body.isDefault === true) data.isDefault = true;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.addressBookEntry.updateMany({ where: { userName: username }, data: { isDefault: false } });
    }
    return tx.addressBookEntry.update({ where: { id }, data });
  });
  return NextResponse.json({ ok: true, address: { id: updated.id, isDefault: updated.isDefault } });
}

/**
 * DELETE /api/app/addresses?id= — owner-only. Re-homes the default when the
 * default row is removed (oldest remaining becomes default).
 */
export async function DELETE(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = String(auth.user.username ?? "").trim();
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.addressBookEntry.findUnique({ where: { id } });
  if (!existing || existing.userName !== username) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.addressBookEntry.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.addressBookEntry.findFirst({
        where: { userName: username },
        orderBy: { id: "asc" },
      });
      if (next) await tx.addressBookEntry.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  return NextResponse.json({ ok: true });
}
