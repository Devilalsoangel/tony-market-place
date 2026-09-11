import { NextRequest, NextResponse } from "next/server";
import { checkAppKey, unauthorized } from "@/lib/promotions/api-auth";
import { createPendingPurchase } from "@/lib/promotions/activate";
import { getGateway } from "@/lib/promotions/gateway";
import { getAppUser } from "@/lib/app-auth";

export async function POST(request: NextRequest) {
  if (!checkAppKey(request)) return unauthorized();
  const caller = await getAppUser(request);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // Same dev-simulation gate as /confirm — never mint fake provider ids in production.
  if (process.env.NODE_ENV === "production" && process.env.DEV_SIMULATE !== "true") {
    return NextResponse.json({ error: "Dev simulation is disabled." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  const packageId = String(body.packageId ?? "");
  // sellerId is bound to the authenticated caller, client value is ignored (prevents spoofing other sellers)
  const sellerId = String(caller.user.username ?? caller.user.id);
  if (!kind || !packageId || !sellerId) {
    return NextResponse.json({ error: "kind, packageId and sellerId are required." }, { status: 400 });
  }

  const pending = await createPendingPurchase({
    kind: kind as never,
    packageId,
    sellerId,
    productId: body.productId ? String(body.productId) : undefined,
    discountedPrice: undefined,
    postId: body.postId ? String(body.postId) : undefined,
    postTitle: body.postTitle ? String(body.postTitle) : undefined,
    postImage: body.postImage ? String(body.postImage) : undefined,
    postExcerpt: body.postExcerpt ? String(body.postExcerpt) : undefined,
  });
  if (!pending.ok) {
    if (pending.error === "database_unavailable") {
      return NextResponse.json({ error: "Database required for purchases.", demo: true }, { status: 503 });
    }
    return NextResponse.json({ error: pending.error }, { status: 400 });
  }

  const gateway = getGateway("dev");
  const checkout = await gateway.createCheckout({
    referenceId: pending.checkoutRef,
    amount: pending.amountPaid,
    currency: pending.currency,
    description: "Promotion slot",
  });

  return NextResponse.json({
    checkoutRef: pending.checkoutRef,
    amountPaid: pending.amountPaid,
    currency: pending.currency,
    payment: checkout.clientPayload,
  });
}