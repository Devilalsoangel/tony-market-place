import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAppUser } from "@/lib/app-auth";

const MAX_CONCURRENT_PINS = 3;

/** POST /api/app/chat/threads/[id]/pin
 *  Pinned-chat VAS (OLX Elite pattern): a SELLER pays (wallet debit happens
 *  app-side BEFORE this call) to pin an existing thread at the top of the
 *  OTHER participant's inbox for `days`. The server records the entitlement:
 *  requester must be a real thread participant, days clamp 1..30, and each
 *  seller can hold at most MAX_CONCURRENT_PINS active pins. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const username = auth.user.username!;
  const { id } = await ctx.params;

  // Only sellers can purchase pinned-chat VAS - buyers never see the feature.
  if (!auth.user.isSeller) return NextResponse.json({ error: "Only sellers can pin chats" }, { status: 403 });

  let body: { days?: number; ref?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawDays = Number(body?.days ?? 7);
  const days = Math.min(30, Math.max(1, Math.round(Number.isFinite(rawDays) ? rawDays : 7)));

  const thread = await prisma.chatThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (thread.participantA !== username && thread.participantB !== username) {
    return NextResponse.json({ error: "Not a participant of this thread" }, { status: 403 });
  }

  const now = new Date();
  // activePins check moved inside $transaction to prevent concurrent bypass (race → 4 pins). See below.

  // Server-authoritative pin purchase: price comes from admin AppSetting
  // promoPrices (mirrors /api/v1/config), wallet is debited atomically so
  // direct POST without paying is impossible.
  let pinPrice = 79;
  try {
    const row: any = await prisma.appSetting.findUnique({ where: { key: "promoPrices" } });
    const overrides = row?.value as Record<string, unknown> | null;
    const raw = overrides?.chatPin;
    // Upper clamp: an admin typo (extra zero) must never drain a wallet —
    // pins are micro-purchases, capped like the payout fee.
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) pinPrice = Math.min(1000, Math.round(raw));
  } catch {}
  // Allow 0-price pins in dev/test; otherwise enforce wallet debit.
  if (pinPrice > 0) {
    const rawRef = String(body?.ref ?? "").trim().slice(0, 64);
    const hasRef = /^[A-Za-z0-9_-]{8,64}$/.test(rawRef);
    const priceTitle = hasRef
      ? `Chat Pin · ${days}d · ${rawRef}`
      : `Chat Pin · ${days} days · ${Date.now()}-${Math.random().toString(36).slice(2, 4)}`;
    // Idempotent retry: the same ref returns the live pin without re-debiting.
    // STRICT dedupe: title-existence alone is not proof of payment (a
    // poisoned -1 row under the same title used to convert the paid pin into
    // a free claim that also lied about thread state). The row must carry
    // THIS thread in its detail and the exact price as its amount.
    // Price-move safety: a same-ref retry after an admin price change matches
    // the title but NOT the amount — 409 with a fresh-ref instruction instead
    // of debiting the new price on top of the old (double charge).
    if (hasRef) {
      const dup = await prisma.walletTransaction.findFirst({
        where: { username, title: priceTitle },
        select: { title: true, amount: true, detail: true },
      });
      if (dup) {
        // Mismatch (amount or thread) usually means a poisoned row — 409 with
        // a fresh-ref instruction. EXCEPT the timeout-after-commit edge: the
        // first attempt may have pinned the thread under an older price
        // (admin moved it mid-retry). The pin write is atomic with the debit,
        // so a live self-pin proves payment — return it deduped instead of
        // charging a second time.
        const livePin = await prisma.chatThread.findUnique({ where: { id: thread.id }, select: { pinnedUntil: true, pinnedBy: true } }).catch(() => null);
        const pinTs = livePin?.pinnedUntil instanceof Date ? livePin.pinnedUntil.getTime() : Number(livePin?.pinnedUntil ?? NaN);
        if (String((livePin as { pinnedBy?: unknown } | null)?.pinnedBy ?? "") === username && Number.isFinite(pinTs) && (pinTs as number) > Date.now()) {
          return NextResponse.json({ pinnedUntil: pinTs, days, charged: 0, deduped: true }, { status: 200 });
        }
        return NextResponse.json({ error: "Pin price changed since this attempt — retry with a fresh request, never the same ref" }, { status: 409 });
      }
    }
    let debited: Date | null = null;
    try {
      debited = await prisma.$transaction(async (tx) => {
        const activePins = await tx.chatThread.count({
          where: { pinnedBy: username, pinnedUntil: { gt: now }, id: { not: thread.id } },
        });
        if (activePins >= MAX_CONCURRENT_PINS) throw new Error(`LIMIT:${MAX_CONCURRENT_PINS}`);
        const res = await tx.user.updateMany({
          where: { id: auth.user.id, walletBalance: { gte: pinPrice } },
          data: { walletBalance: { decrement: pinPrice } },
        });
        if (res.count === 0) throw new Error("BALANCE");
        await tx.walletTransaction.create({
          data: { username, title: priceTitle, detail: `Pinned chat ${thread.id} · ${days}d`, amount: -pinPrice },
        });
        const pinnedUntil = new Date(now.getTime() + days * 864e5);
        await tx.chatThread.update({ where: { id: thread.id }, data: { pinnedUntil, pinnedBy: username } });
        return pinnedUntil;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("LIMIT:")) return NextResponse.json({ error: `Pinned-chat limit reached (${MAX_CONCURRENT_PINS}). Wait for one to expire or unpurchase.` }, { status: 403 });
      if (msg === "BALANCE") return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
      // Concurrent retry already committed (UNIQUE username+title): report the
      // winner — but VERIFIED like the pre-check above. The old code returned
      // success for any P2002, so the same ref POSTed against two threads
      // reported a pin on a thread never pinned. Winner row must carry this
      // thread + this price, or a live self-pin must prove payment.
      if ((e as { code?: string })?.code === "P2002") {
        const winner = await prisma.walletTransaction.findFirst({
          where: { username, title: priceTitle },
          select: { amount: true, detail: true },
        }).catch(() => null);
        const winnerOk = !!winner
          && Number(winner.amount ?? 0) === -pinPrice
          && String(winner.detail ?? "").includes(thread.id);
        if (winnerOk) {
          const cur = await prisma.chatThread.findUnique({ where: { id: thread.id }, select: { pinnedUntil: true } });
          return NextResponse.json({ pinnedUntil: cur?.pinnedUntil?.getTime() ?? Date.now() + days * 864e5, days, charged: 0, deduped: true }, { status: 200 });
        }
        const livePin = await prisma.chatThread.findUnique({ where: { id: thread.id }, select: { pinnedUntil: true, pinnedBy: true } }).catch(() => null);
        const pinTs = livePin?.pinnedUntil instanceof Date ? livePin.pinnedUntil.getTime() : Number((livePin as { pinnedUntil?: unknown } | null)?.pinnedUntil ?? NaN);
        if (String((livePin as { pinnedBy?: unknown } | null)?.pinnedBy ?? "") === username && Number.isFinite(pinTs) && (pinTs as number) > Date.now()) {
          return NextResponse.json({ pinnedUntil: pinTs, days, charged: 0, deduped: true }, { status: 200 });
        }
        return NextResponse.json({ error: "Pin conflict — retry with a fresh request, never the same ref" }, { status: 409 });
      }
      throw e;
    }
    if (!debited) return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    return NextResponse.json({ pinnedUntil: debited.getTime(), days, charged: pinPrice }, { status: 200 });
  }

  // Free pin path (pinPrice 0) still needs atomic limit check.
  try {
    const pinnedUntil = await prisma.$transaction(async (tx) => {
      const activePins = await tx.chatThread.count({
        where: { pinnedBy: username, pinnedUntil: { gt: now }, id: { not: thread.id } },
      });
      if (activePins >= MAX_CONCURRENT_PINS) throw new Error(`LIMIT:${MAX_CONCURRENT_PINS}`);
      const until = new Date(now.getTime() + days * 864e5);
      await tx.chatThread.update({ where: { id: thread.id }, data: { pinnedUntil: until, pinnedBy: username } });
      return until;
    });
    return NextResponse.json({ pinnedUntil: pinnedUntil.getTime(), days }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("LIMIT:")) return NextResponse.json({ error: `Pinned-chat limit reached (${MAX_CONCURRENT_PINS}). Wait for one to expire or unpurchase.` }, { status: 403 });
    throw e;
  }
}
