import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db";

import { getAppUser } from "@/lib/app-auth";

import { resolveCommissionRate, settlementGoodsBasis, settledFeeFromLegs } from "@/lib/commission";



export async function GET(req: NextRequest) {

  const auth = await getAppUser(req);

  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prisma = await getPrisma();

  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });



  const [balance, transactions] = await Promise.all([

    prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true, loyaltyPoints: true } }),

    prisma.walletTransaction.findMany({

      where: { username: auth.user.username! },

      orderBy: { ts: "desc" },

      take: 100,

    }),

  ]);

  return NextResponse.json({

    balance: balance?.walletBalance ?? 0,

    loyaltyPoints: balance?.loyaltyPoints ?? 0,

    transactions: transactions.map((t) => ({

      id: t.id,

      title: t.title,

      detail: t.detail,

      amount: t.amount,

      ts: t.ts.getTime(),

    })),

  });

}



// Debit wallet + record a transaction (checkout, promotions, payouts).

// Positive credits are minted ONLY through the gated top-up path below -

// refunds/settlements credit wallets server-side, never from client bodies.

export async function POST(req: NextRequest) {

  const auth = await getAppUser(req);

  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prisma = await getPrisma();

  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });



  let body: { amount?: number; title?: string; detail?: string; type?: string };

  try {

    body = await req.json();

  } catch {

    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  }

  const amount = Number(body.amount ?? 0);

  if (!Number.isFinite(amount) || amount === 0) {

    return NextResponse.json({ error: "Amount required" }, { status: 400 });

  }

  // Industry invariant: the wallet is whole-rupee only. Fractional debits
  // would poison integer balances and every downstream sum (ledger drift).
  // Top-ups already enforce this below; debits are closed here.
  if (!Number.isInteger(amount)) {

    return NextResponse.json({ error: "Amount must be a whole number (no paise)" }, { status: 400 });

  }



  let title: string;

  if (amount > 0) {

    // Top-ups only: explicit type + sane integer bounds, unique ledger title per top-up.

    if (body.type !== "topup") {

      return NextResponse.json({ error: "Client-supplied credits are not accepted" }, { status: 400 });

    }

    // CRITICAL: In production, top-ups must go through a payment gateway.
    // Direct balance increment without payment is only allowed in dev/simulate mode.
    // This prevents anyone from minting arbitrary wallet balance by calling the API.
    if (process.env.NODE_ENV === "production" && process.env.WALLET_DEV_TOPUP !== "true") {
      return NextResponse.json(
        { error: "Direct top-up is disabled in production. Use the payment gateway flow." },
        { status: 403 }
      );
    }

    if (!Number.isInteger(amount) || amount < 1 || amount > 50000) {

      return NextResponse.json({ error: "Top-up must be an integer between 1 and 50000" }, { status: 400 });

    }

    title = `Wallet top-up · ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  } else {

    const rawTitle = String(body.title ?? "Wallet transaction");

    // Guard: client must not be able to poison ledger titles that double as

    // idempotency guards for refunds/earnings/clawbacks.

    const blocked = /Order (cancelled|earnings|clawback|refund)/i.test(rawTitle);

    if (blocked) {

      return NextResponse.json({ error: "Reserved transaction title" }, { status: 400 });

    }

    const baseTitle = rawTitle.slice(0, 80);
    if (!body.title || baseTitle === "Wallet transaction") {
      title = `Wallet transaction · ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    } else {
      title = baseTitle;
    }

  }



  const detail = String(body.detail ?? "");

  // Atomic compare-and-set: debit uses updateMany with walletBalance guard so

  // concurrent debits cannot both pass the balance check (READ COMMITTED race).

  // Top-up uses atomic increment. WalletTransaction stays inside same $transaction.

  const result = await prisma.$transaction(async (tx) => {

    const existing = await tx.user.findUnique({ where: { id: auth.user.id }, select: { id: true, username: true } });

    if (!existing) throw new Error("User not found");

    if (amount < 0) {

      const res = await tx.user.updateMany({

        where: { id: auth.user.id, walletBalance: { gte: -amount } },

        data: { walletBalance: { decrement: -amount } },

      });

      if (res.count === 0) {

        const cur = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });

        throw new Error(`Insufficient wallet balance:${cur?.walletBalance ?? 0}`);

      }

    } else {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await (tx as any).walletTransaction.findMany({ where: { username: existing.username, title: { startsWith: 'Wallet top-up' }, amount: { gt: 0 }, ts: { gte: since } }, select: { amount: true } });
      const sum = recent.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      if (recent.length >= 10) throw new Error('Top-up limit reached: max 10 per 24h');
      if (sum + amount > 100000) throw new Error('Top-up limit reached: max 100000 per 24h');
      await tx.user.update({ where: { id: auth.user.id }, data: { walletBalance: { increment: amount } } });

    }

    const updated = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });

    const newBalance = updated!.walletBalance;

    await tx.walletTransaction.create({ data: { username: existing.username!, title, detail, amount } });

    return { newBalance, bal: newBalance - amount };

  }).catch((e: unknown) => {

    const msg = e instanceof Error ? e.message : String(e);

    if (msg.startsWith("Insufficient wallet balance:")) {

      const bal = Number(msg.split(":")[1] ?? 0);

      return { err: "Insufficient wallet balance" as unknown as string, bal };

    }

    if (msg === "User not found") return { err: "User not found" as unknown as string };
    if (msg.startsWith("Top-up limit reached")) return { err: msg as unknown as string };
    if (msg.includes("Unique constraint") || msg.includes("P2002") || (e as { code?: string })?.code === "P2002") return { err: "Duplicate transaction — already processed" as unknown as string };

    throw e;

  });

  if ("err" in result) {

    const status = result.err === "User not found" ? 404 : 400;

    return NextResponse.json({ error: result.err, ...(result.bal !== undefined ? { balance: result.bal } : {}) }, { status });

  }

  return NextResponse.json({ balance: result.newBalance, transaction: { title, detail, amount } });

}

class PayoutError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ── Transactional payout endpoint (industry payout flow) ────────────────────
// PUT /api/app/wallet/payout  { amount }
// The wallet debit (amount + payout fee) and the desk row (Withdrawal, status
// "requested") commit in ONE $transaction: a debit can never exist without its
// payout record and vice versa. The old two-phase client flow (walletTx debit,
// then a separate mirror POST) could strand a debit with no desk record —
// sellers' money silently stuck. Status transitions afterwards are desk-only
// (see /api/data/withdrawals PATCH guard); the app reads verdicts through
// GET /api/app/withdrawals.
export async function PUT(req: NextRequest) {
  const auth = await getAppUser(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const amount = Math.floor(Number(body.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500000) {
    return NextResponse.json({ error: "Amount must be between 1 and 500000" }, { status: 400 });
  }
  // Payout fee resolves from CommissionSetting (admin-editable) so the
  // server never disagrees with the live fee the app shows at the gate.
  let fee = 20;
  try {
    const setting = await prisma.commissionSetting.findUnique({ where: { id: "global" } });
    const f = Number(setting?.payoutFee);
    if (Number.isFinite(f) && f >= 0 && f <= 1000) fee = Math.floor(f);
  } catch {}
  const totalDebit = amount + fee;

  try {
      const wdId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { id: true, username: true, name: true },
      });
      if (!user) throw new PayoutError("User not found", 404);
      // Earnings guard: payouts draw from delivered-order earnings, never
      // from top-up balance (previously anyone could cash out top-ups minus
      // the fee). Lifetime coupon-aware goods-net minus non-rejected payouts
      // = withdrawable. Matches the app's netEarnings gate, now enforced.
      const rate = await resolveCommissionRate(tx as never).catch(() => 0.08);
      const soldRows = await tx.order.findMany({
        where: { sellerUsername: user.username!, status: "delivered" },
        select: { itemsList: true },
      });
      // Settled per-line legs (rate AT SALE TIME) — never revalue history at
      // the CURRENT rate, or an admin rate change retroactively shrinks or
      // inflates withdrawable balances. Legacy rows fall back to the rate.
      let lifetimeNet = 0;
      for (const o of soldRows) {
        const itemsList = (o as { itemsList?: unknown }).itemsList;
        const b = settlementGoodsBasis(itemsList);
        if (!Number.isFinite(b) || (b as number) <= 0) continue;
        const legFee = settledFeeFromLegs(itemsList);
        lifetimeNet += legFee !== null
          ? Math.max(0, Math.round(b as number) - legFee)
          : Math.max(0, Math.round((b as number) * (1 - rate)));
      }
      const priorWd = await tx.withdrawal.findMany({
        where: {
          userName: { in: [user.username!, user.name || ""].filter(Boolean) },
          status: { in: ["requested", "approved", "completed"] },
        },
        select: { amount: true },
      });
      const paidOut = priorWd.reduce((s, w) => s + Math.max(0, Number((w as { amount?: unknown }).amount ?? 0)), 0);
      if (amount > lifetimeNet - paidOut) {
        throw new PayoutError("Payout exceeds delivered earnings", 400);
      }
      // The wallet must cover amount + fee (same rule the app enforced
      // client-side; now server-authoritative). Atomic compare-and-set so
      // concurrent debits cannot both pass the balance check.
      const res = await tx.user.updateMany({
        where: { id: user.id, walletBalance: { gte: totalDebit } },
        data: { walletBalance: { decrement: totalDebit } },
      });
      if (res.count === 0) throw new PayoutError("Insufficient wallet balance", 400);
      const wd = await tx.withdrawal.create({
        data: {
          // Keyed by unique username (NOT display name): two sellers sharing
          // "Aarav" must never see each other's payouts, and renames must not
          // orphan history. The desk renders the same identifier.
          userName: user.username!,
          method: "bank",
          amount,
          status: "requested",
          requestedAt: new Date(),
        },
      });
      await tx.walletTransaction.create({
        data: {
          username: user.username!,
          title: "Withdrawal to bank",
          detail: `Payout request ${wd.id} · ₹${fee} fee`,
          amount: -totalDebit,
        },
      });
      return wd.id;
    });
    return NextResponse.json({ ok: true, withdrawalId: wdId });
  } catch (e: unknown) {
    if (e instanceof PayoutError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}