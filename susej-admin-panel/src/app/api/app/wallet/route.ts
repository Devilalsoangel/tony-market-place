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



  let body: { amount?: number; title?: string; detail?: string; type?: string; ref?: string };

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
    // Idempotency: when the client supplies a stable per-intent ref (one UUID
    // per tap, reused across timeout-retries), the title is deterministic so
    // a retry collides on UNIQUE(username,title) instead of minting twice.
    const rawRef = String((body as { ref?: unknown }).ref ?? "").trim().slice(0, 64);
    if (/^[A-Za-z0-9_-]{8,64}$/.test(rawRef)) {
      title = `Wallet top-up · ${rawRef}`;
      const dup = await prisma.walletTransaction.findFirst({
        where: { username: auth.user.username!, title },
        select: { title: true, amount: true, detail: true },
      });
      if (dup) {
        // Echo the SETTLED row (never the request): a retry carrying a
        // different amount must not let the caller mint the delta as credit.
        const bal = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });
        return NextResponse.json({ balance: bal?.walletBalance ?? 0, transaction: { title: dup.title, detail: dup.detail, amount: dup.amount }, deduped: true });
      }
    }

  } else {

    // Fail-closed: generic-lane debits move wallet money with no ledgerEntry
    // mirror (LedgerEntry.orderId is required, and this lane has no order),
    // so the Settlements page could never reconcile them. No live caller
    // spends through here (top-ups are credits; orders/payouts/promos/pins
    // all debit through their own mirrored routes) — refuse outright.
    if (amount < 0) {
      return NextResponse.json({ error: "Direct debits are disabled — use the order, payout, or promotion flow" }, { status: 400 });
    }

    const rawTitle = String(body.title ?? "Wallet transaction");

    // Guard (H6): client must not be able to poison ledger titles that double
    // as idempotency guards. A pre-created "Dispute refund · X" (-1) would
    // make the real ruling's count-guard see 1 and skip the buyer's credit;
    // same for clawback/payout titles (seller keeps funds on refunded
    // orders). Covers every settlement taxonomy, not just Order-*.
    // Extended: Chat Pin titles double as the pin route's dedupe key (a
    // pre-minted "Chat Pin · 7d · ref" for -1 turned the paid pin into a free
    // deduped claim); Promotion/Withdrawal titles are server-minted only
    // (promo debits/refunds, payout debits/reject-refunds) — the app never
    // sends a legitimate generic-lane debit under these names.
    const blocked = /Order (cancelled|earnings|clawback|refund)|Dispute (refund|split)|Withdrawal|Payout rejected|Wallet top-up|Chat Pin|Promotion/i.test(rawTitle);

    if (blocked) {

      return NextResponse.json({ error: "Reserved transaction title" }, { status: 400 });

    }

    // Detail spoofing closes the same hole from the other side: the payout-
    // reject refund looks up the original debit by detail-contains-id. A
    // client debit carrying "Payout request <id>" would be picked as the
    // debit and refunded 1 instead of the full amount (only the payout route
    // itself may mint those details).
    const rawDetail = String(body.detail ?? "");
    if (amount < 0 && /payout request|withdrawal/i.test(rawDetail)) {
      return NextResponse.json({ error: "Reserved transaction detail" }, { status: 400 });
    }

    const baseTitle = rawTitle.slice(0, 80);
    if (!body.title || baseTitle === "Wallet transaction") {
      title = `Wallet transaction · ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    } else {
      title = baseTitle;
    }

    // Race-close (hostile-audit 1a): the pre-tx ref check above can't stop two
    // concurrent same-ref POSTs, but the UNIQUE(username,title) constraint can
    // — iff the title is deterministic per ref. Suffix it so a retry collides
    // into the P2002-deduped path instead of double-charging. Distinct taps
    // mint distinct refs, so legit repeats never collide. Budget the base so
    // the REF is never clipped (clipping the ref's last char would false-dedupe
    // two distinct intents sharing an 80-char title prefix).
    const rawDebitRef = String((body as { ref?: unknown }).ref ?? "").trim().slice(0, 64);
    if (/^[A-Za-z0-9_-]{8,64}$/.test(rawDebitRef) && !title.includes(rawDebitRef)) {
      const suffix = ` · ref-${rawDebitRef}`;
      title = `${title.slice(0, Math.max(0, 150 - suffix.length))}${suffix}`;
    }
    // Cross-title same-ref replay guard: the UNIQUE key is (username,title),
    // so the same ref under a DIFFERENT base title would debit twice. A ref
    // that already settled under ANY title replays as deduped. EXACT ref
    // equality (parsed after the last `ref-`): a suffix-substring match let
    // ref X false-hit settled ref Y when X was Y's tail (self-denial of the
    // caller's own credit — fail-closed, but wrong).
    // (Pre-tx read: closes sequential replays; concurrent cross-title same-ref
    // needs a unique ref column — migration-tracked. Self-scope only: rows are
    // always username-bound to the caller, so no cross-user effect.)
    if (/^[A-Za-z0-9_-]{8,64}$/.test(rawDebitRef)) {
      const candidates = await prisma.walletTransaction.findMany({
        where: { username: auth.user.username!, title: { endsWith: `ref-${rawDebitRef}` } },
        select: { title: true, amount: true, detail: true },
      }).catch(() => []);
      const priorRef = candidates.find((r) => {
        const m = String(r.title ?? "").match(/ref-([A-Za-z0-9_-]{8,64})$/);
        return m?.[1] === rawDebitRef;
      });
      if (priorRef) {
        const bal = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } });
        return NextResponse.json({ balance: bal?.walletBalance ?? 0, transaction: { title: priorRef.title, detail: priorRef.detail, amount: priorRef.amount }, deduped: true });
      }
    }

  }



  const detail = String(body.detail ?? "");

  // Atomic compare-and-set: debit uses updateMany with walletBalance guard so

  // concurrent debits cannot both pass the balance check (READ COMMITTED race).

  // Top-up uses atomic increment. WalletTransaction stays inside same $transaction.

  const result = await prisma.$transaction(async (tx) => {

    // Serialize concurrent top-ups on the user row: the 24h cap reads below
    // are non-locking, so a retry storm could slip past them together.
    // Fail-closed (no catch): a lock failure aborts the tx, never proceeds
    // unlocked past the caps. The `?.` stays for providers without raw
    // queries — absent lock primitive, absent lock (documented, Neon has it).
    await (tx as any).$queryRawUnsafe?.(`SELECT id FROM "User" WHERE id = $1 FOR UPDATE`, auth.user.id);

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

  }).catch(async (e: unknown) => {

    const msg = e instanceof Error ? e.message : String(e);

    if (msg.startsWith("Insufficient wallet balance:")) {

      const bal = Number(msg.split(":")[1] ?? 0);

      return { err: "Insufficient wallet balance" as unknown as string, bal };

    }

    if (msg === "User not found") return { err: "User not found" as unknown as string };
    if (msg.startsWith("Top-up limit reached")) return { err: msg as unknown as string };
    // Idempotency race: a concurrent retry with the same deterministic title
    // already committed (UNIQUE username+title rolled this tx back) — report
    // the winner as success so callers never show "failed" for landed money.
    if (msg.includes("Unique constraint") || msg.includes("P2002") || (e as { code?: string })?.code === "P2002") {
      const bal = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } }).catch(() => null);
      return { newBalance: bal?.walletBalance ?? 0, bal: (bal?.walletBalance ?? 0) - amount, deduped: true };
    }

    throw e;

  });

  if ("err" in result) {

    const status = result.err === "User not found" ? 404 : 400;

    return NextResponse.json({ error: result.err, ...(result.bal !== undefined ? { balance: result.bal } : {}) }, { status });

  }

  return NextResponse.json({ balance: result.newBalance, transaction: { title, detail, amount }, ...("deduped" in result && result.deduped ? { deduped: true } : {}) });

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

  let body: { amount?: number; method?: string; ref?: unknown; destination?: unknown; feePreview?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const amount = Math.floor(Number(body.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500000) {
    return NextResponse.json({ error: "Amount must be between 1 and 500000" }, { status: 400 });
  }
  // Rail choice is real: bank vs UPI persists on the Withdrawal row and the
  // ledger title, so the desk pays to the right destination. Default bank for
  // legacy clients that send amount-only.
  const method = body.method === "upi" ? "upi" : "bank";
  // Idempotency key (P0 double-debit): per-tap client ref mints a
  // deterministic walletTx title on UNIQUE(username,title), so a
  // timeout-retry collides instead of debiting twice. The amount+60s window
  // below stays as a backstop for legacy clients that send no ref.
  // The key is METHOD-INDEPENDENT (`Withdrawal · ref-<ref>`): the old
  // method-scoped titles let the same ref debit twice via a bank↔UPI flip.
  // Legacy method-scoped titles are still honored as dedupe evidence (one
  // deploy cycle of overlap) so retries across the deploy never double-debit.
  const rawRef = String(body.ref ?? "").trim().slice(0, 64);
  const payoutRef = /^[A-Za-z0-9_-]{8,64}$/.test(rawRef) ? rawRef : null;
  const payoutTitle =
    method === "upi" ? "Withdrawal to UPI" : "Withdrawal to bank";
  const idemTitle = payoutRef ? `Withdrawal · ref-${payoutRef}` : payoutTitle;
  const legacyIdemTitles = payoutRef
    ? [`Withdrawal to bank · ref-${payoutRef}`, `Withdrawal to UPI · ref-${payoutRef}`]
    : [];
  if (payoutRef) {
    try {
      const dupTx = await prisma.walletTransaction.findFirst({
        where: { username: auth.user.username!, title: { in: [idemTitle, ...legacyIdemTitles] } },
        select: { detail: true },
      });
      if (dupTx) {
        // Return the MATCHING payout (parsed from the dedupe row's detail),
        // not the latest row — interleaved payouts made the old lookup lie.
        let matchedId = "";
        const m = String(dupTx.detail ?? "").match(/Payout request (\S+)/);
        if (m) {
          const owned = await prisma.withdrawal.findFirst({
            where: { id: m[1], userName: auth.user.username! },
            select: { id: true },
          }).catch(() => null);
          if (owned) matchedId = owned.id;
        }
        if (!matchedId) {
          const prior = await prisma.withdrawal.findFirst({
            where: { userName: auth.user.username! },
            orderBy: { requestedAt: "desc" },
            select: { id: true },
          }).catch(() => null);
          matchedId = prior?.id ?? "";
        }
        return NextResponse.json({ ok: true, withdrawalId: matchedId, deduped: true });
      }
    } catch {}
  }
  // Double-submit guard (SELLER-C4): legacy no-ref clients only. Ref-bearing
  // clients dedupe by deterministic title above — the amount+60s window
  // false-dedupes two LEGIT distinct payouts a minute apart (two suppliers,
  // same ₹5000: second returns first's id, B never paid). Method-scoped so a
  // bank payout never dedupes a UPI one.
  if (!payoutRef) {
  try {
    const recent = await prisma.withdrawal.findFirst({
      where: {
        userName: auth.user.username!,
        amount,
        method,
        status: "requested",
        requestedAt: { gte: new Date(Date.now() - 60000) },
      },
      orderBy: { requestedAt: "desc" },
    });
    if (recent) return NextResponse.json({ ok: true, withdrawalId: recent.id, deduped: true });
  } catch {}
  }
  // Payout fee resolves from CommissionSetting (admin-editable) so the
  // server never disagrees with the live fee the app shows at the gate.
  let fee = 20;
  try {
    const setting = await prisma.commissionSetting.findUnique({ where: { id: "global" } });
    const f = Number(setting?.payoutFee);
    if (Number.isFinite(f) && f >= 0 && f <= 1000) fee = Math.floor(f);
  } catch {}
  // Fee reconfirm (fail-closed, never fail-charged): the app gates on a fee
  // preview that can go stale mid-session. When the caller states what it
  // showed and the live fee moved, 400 with both figures instead of debiting
  // more than the seller approved (bounded by the 1000 clamp, still a
  // surprise). Absent preview (undefined AND null) = legacy client, charge
  // live fee as before.
  const feePreviewRaw = (body as { feePreview?: unknown }).feePreview;
  const feePreview = feePreviewRaw === undefined || feePreviewRaw === null ? null : Math.floor(Number(feePreviewRaw));
  if (feePreview !== null && Number.isFinite(feePreview) && feePreview !== fee) {
    return NextResponse.json({ error: `Payout fee changed (was ₹${feePreview}, now ₹${fee}) — review and submit again` }, { status: 400 });
  }
  const totalDebit = amount + fee;

  // Beneficiary resolution — the rail travels AND the account does (a payout
  // request with no destination is unpayable). Bank payouts go ONLY to the
  // KYC-verified account on the seller's file (verified-beneficiary
  // directory, RazorpayX pattern): free-typed account numbers are a
  // misdirection/fraud vector and are never accepted. UPI needs an explicit
  // VPA per request — a phone number is NOT a VPA (handles change, non-UPI
  // phones exist) — format-validated on both sides.
  let destination = "";
  if (method === "bank") {
    // Stable identity first: app-filed Seller rows carry id `app_<username>`
    // (deterministic at KYC time). Contact-keyed lookup is the legacy
    // fallback only — an email change post-approval must not orphan payouts.
    let acct = "";
    const stableRow = await prisma.seller
      .findUnique({ where: { id: `app_${auth.user.username!}` }, select: { bankAccount: true } })
      .catch(() => null) as { bankAccount?: unknown } | null;
    acct = String(stableRow?.bankAccount ?? "").replace(/\D/g, "");
    if (!acct) {
      const ors: Array<Record<string, unknown>> = [];
      if (auth.user.email) ors.push({ email: auth.user.email });
      if (auth.user.phone) ors.push({ phone: auth.user.phone });
      if (ors.length) {
        const sellerRow = await prisma.seller
          .findFirst({ where: { OR: ors }, select: { bankAccount: true } })
          .catch(() => null) as { bankAccount?: unknown } | null;
        acct = String(sellerRow?.bankAccount ?? "").replace(/\D/g, "");
      }
    }
    // Short/typo'd numbers (e.g. "123") are unpayable — refuse before the
    // desk can certify them. Indian account numbers run 9–18 digits.
    if (!acct || acct.length < 9) {
      return NextResponse.json(
        { error: "No verified bank account on file — complete seller verification first" },
        { status: 400 }
      );
    }
    destination = acct;
  } else {
    const vpa = String(body.destination ?? "").trim().slice(0, 80);
    if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(vpa)) {
      return NextResponse.json({ error: "Enter a valid UPI ID (name@bank)" }, { status: 400 });
    }
    destination = vpa;
  }

  try {
      const wdId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        select: { id: true, username: true, name: true },
      });
      if (!user) throw new PayoutError("User not found", 404);
      // LOCK ORDER (deadlock discipline, system-wide): Order rows BEFORE User
      // rows, matching every refund/dispute/cancel/deliver path. The payout
      // used to lock User first while settlement paths lock Order first —
      // same-tick payout + refund-approve deadlocked or, worse, both passed
      // on split snapshots (withdraw-after-refund). Locking this seller's
      // delivered rows first serializes payout against any concurrent
      // settlement on those rows; the guard re-read below then observes
      // committed paymentStatus/freeze state.
      // Case-insensitive like every identity check (write lanes are):
      // legacy mixed-case sellerUsername rows missed an exact-match lock and
      // deserialized payout vs refund-approve again.
      // Fail-closed (no catch): a lock failure aborts the tx, never proceeds
      // unlocked past the earnings guard. `?.` stays for raw-less providers.
      await (tx as any).$queryRawUnsafe?.(
        `SELECT id FROM "Order" WHERE lower("sellerUsername") = lower($1) AND status = 'delivered' FOR UPDATE`,
        user.username!
      );
      await (tx as any).$queryRawUnsafe?.(`SELECT id FROM "User" WHERE id = $1 FOR UPDATE`, user.id);
      // Serialize concurrent payouts on the user row: the earnings guard
      // below is a non-locking read, so two parallel requests with different
      // refs both passed lifetimeNet-paidOut and cashed out top-ups as bank
      // cash. The loser now blocks until the winner commits, then reads the
      // winner's withdrawal row in priorWd and fails the guard honestly.
      // Earnings guard: payouts draw from delivered-order earnings, never
      // from top-up balance (previously anyone could cash out top-ups minus
      // the fee). Lifetime coupon-aware goods-net minus non-rejected payouts
      // = withdrawable. Matches the app's netEarnings gate, now enforced.
      const rate = await resolveCommissionRate(tx as never).catch(() => 0.08);
      // Fail-closed (API-H2): refunded orders pay nothing withdrawable. A
      // seller refunded in full keeps status "delivered" with paymentStatus
      // "refunded" — counting it would let withdraw-after-refund double-spend
      // (clawback already took the money back). Partial (split) refunds also
      // exclude the whole order: understates withdrawable, never overstates.
      const soldRows = await tx.order.findMany({
        // Case-insensitive party match (write lanes already are — an
        // exact-match guard hid rows the PATCH lane would happily mutate,
        // and the lock above would miss them).
        where: { sellerUsername: { equals: user.username!, mode: "insensitive" }, status: "delivered", paymentStatus: { not: "refunded" } },
        select: { itemsList: true, actualDelivery: true, trackingNumber: true },
      });
      // Disputed-funds freeze (Amazon pattern): an open/under_review dispute
      // freezes its order's net until ruling — otherwise the seller withdraws
      // the full lifetimeNet and a full_refund ruling claws into negative
      // (uncollectible receivable the platform eats). Dispute.orderId carries
      // the trackingNumber.
      let frozenTrackings = new Set<string>();
      try {
        const trackings = soldRows.map((o) => String((o as { trackingNumber?: unknown }).trackingNumber ?? "")).filter(Boolean);
        if (trackings.length) {
          const frozen = await tx.dispute.findMany({
            where: { orderId: { in: trackings }, status: { in: ["open", "under_review"] } },
            select: { orderId: true },
          });
          frozenTrackings = new Set(frozen.map((d) => String(d.orderId)));
        }
      } catch {
        // Fail-CLOSED: a dispute-read failure must never unlock frozen money.
        throw new PayoutError("Payout guard unavailable — try again", 503);
      }
      // Settled per-line legs (rate AT SALE TIME) — never revalue history at
      // the CURRENT rate, or an admin rate change retroactively shrinks or
      // inflates withdrawable balances. Legacy rows fall back to the rate.
      // 7-DAY SETTLEMENT HOLD (anti-wash, Amazon/new-seller-hold pattern):
      // delivered legs unlock 7 days after delivery (return window), so a
      // colluding buyer→seller pair can't spin bonus money into a withdrawal
      // the same afternoon (throttles cap the accounts; the hold kills the
      // velocity). Rows from the pre-hold era carry no actualDelivery stamp
      // and count as matured — the hold only ever delays NEW money.
      const HOLD_MS = 7 * 24 * 3600 * 1000;
      const holdNow = Date.now();
      let heldBack = 0;
      let frozenBack = 0;
      let lifetimeNet = 0;
      for (const o of soldRows) {
        const itemsList = (o as { itemsList?: unknown }).itemsList;
        const b = settlementGoodsBasis(itemsList);
        if (!Number.isFinite(b) || (b as number) <= 0) continue;
        const legFee = settledFeeFromLegs(itemsList);
        const legNet = legFee !== null
          ? Math.max(0, Math.round(b as number) - legFee)
          : Math.max(0, Math.round((b as number) * (1 - rate)));
        if (frozenTrackings.has(String((o as { trackingNumber?: unknown }).trackingNumber ?? ""))) {
          frozenBack += legNet;
          continue;
        }
        const stamp = Date.parse(String((o as { actualDelivery?: unknown }).actualDelivery ?? ""));
        if (Number.isFinite(stamp) && holdNow - stamp < HOLD_MS) {
          heldBack += legNet;
          continue;
        }
        lifetimeNet += legNet;
      }
      const priorWd = await tx.withdrawal.findMany({
        // Case-insensitive party match (lock + soldRows already are — exact
        // here missed legacy mixed-case rows, understating paidOut and
        // overstating withdrawable; split-casing across users merges in
        // soldRows, so this must match that semantics exactly).
        where: {
          OR: [
            { userName: { equals: user.username!, mode: "insensitive" } },
            { userName: { equals: user.name || "", mode: "insensitive" } },
          ],
          status: { in: ["requested", "approved", "completed"] },
        },
        select: { id: true, amount: true },
      });
      // Committed in TOTAL-DEBIT terms (amount + fee): each payout locked
      // amount+fee from the balance, so the earnings check must subtract the
      // same. The fee rides in the debit row's detail (`Payout request <id> ·
      // ₹<fee> fee`); unparseable legacy rows conservatively assume the
      // CURRENT fee (overstates committed → understates withdrawable, never
      // the reverse).
      let paidOut = 0;
      if (priorWd.length) {
        const debitRows = await tx.walletTransaction.findMany({
          where: {
            OR: [
              { username: { equals: user.username!, mode: "insensitive" } },
              { username: { equals: user.name || "", mode: "insensitive" } },
            ],
            amount: { lt: 0 },
            detail: { startsWith: "Payout request " },
          },
          select: { detail: true },
        }).catch(() => [] as Array<{ detail: string | null }>);
        const feeByWd = new Map<string, number>();
        for (const r of debitRows) {
          const m = String(r.detail ?? "").match(/^Payout request (\S+).*?([\d,]+) fee/);
          if (m) feeByWd.set(m[1], Number(m[2].replace(/,/g, "")) || 0);
        }
        for (const w of priorWd) {
          const principal = Math.max(0, Number((w as { amount?: unknown }).amount ?? 0));
          const wfee = feeByWd.get(String((w as { id?: unknown }).id ?? ""));
          paidOut += principal + (wfee !== undefined ? Math.max(0, wfee) : fee);
        }
      }
      if (amount > lifetimeNet - paidOut) {
        throw new PayoutError(
          frozenBack > 0
            ? `Some earnings are frozen under dispute — ₹${frozenBack.toLocaleString("en-IN")} unlocks on ruling`
            : heldBack > 0
              ? `Only settled earnings are withdrawable — ₹${heldBack.toLocaleString("en-IN")} unlocks 7 days after delivery`
              : "Payout exceeds delivered earnings",
          400
        );
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
          method,
          amount,
          status: "requested",
          requestedAt: new Date(),
        },
      });
      await tx.walletTransaction.create({
        data: {
          username: user.username!,
          title: idemTitle,
          // The destination rides in the immutable detail so the finance desk
          // can always see WHERE a payout goes (read-time join on the data
          // plane surfaces it as the Destination column). Format is parsed —
          // keep `· to <destination>` at the end.
          detail: `Payout request ${wd.id} · ₹${fee} fee · via ${method === "upi" ? "UPI" : "bank"} · to ${destination}`,
          amount: -totalDebit,
        },
      });
      return { id: wd.id, destination };
    });
    return NextResponse.json({ ok: true, withdrawalId: wdId.id, destination: wdId.destination });
  } catch (e: unknown) {
    if (e instanceof PayoutError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    // Idempotency race: a concurrent same-ref retry already committed the
    // deterministic title — the loser tx rolled back on UNIQUE(username,title).
    // Report the MATCHING winner (parsed from its detail), not the latest row.
    if ((e as { code?: string })?.code === "P2002" && payoutRef) {
      const winnerTx = await prisma.walletTransaction.findFirst({
        where: { username: auth.user.username!, title: { in: [idemTitle, ...legacyIdemTitles] } },
        select: { detail: true },
      }).catch(() => null);
      let winnerId = "";
      const wm = String(winnerTx?.detail ?? "").match(/Payout request (\S+)/);
      if (wm) {
        const owned = await prisma.withdrawal.findFirst({
          where: { id: wm[1], userName: auth.user.username! },
          select: { id: true },
        }).catch(() => null);
        if (owned) winnerId = owned.id;
      }
      if (!winnerId) {
        const prior = await prisma.withdrawal.findFirst({
          where: { userName: auth.user.username! },
          orderBy: { requestedAt: "desc" },
          select: { id: true },
        }).catch(() => null);
        winnerId = prior?.id ?? "";
      }
      return NextResponse.json({ ok: true, withdrawalId: winnerId, deduped: true });
    }
    throw e;
  }
}