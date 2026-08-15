import { NextRequest } from "next/server";

export interface CheckoutRequest {
  referenceId: string;
  amount: number;
  currency: string;
  description: string;
}

export interface CheckoutResult {
  provider: string;
  providerPaymentId: string;
  clientPayload: Record<string, unknown>;
}

export interface WebhookResult {
  eventType: "payment.succeeded" | "payment.refunded";
  providerPaymentId: string;
}

export interface PaymentGateway {
  readonly provider: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  verifyWebhook(request: NextRequest): Promise<WebhookResult | null>;
}

export class DevGateway implements PaymentGateway {
  readonly provider = "dev";

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    return {
      provider: this.provider,
      providerPaymentId: `dev_${req.referenceId}`,
      clientPayload: {
        dev: true,
        message: "Dev gateway - call /api/v1/promotions/confirm with the checkoutRef to simulate payment success.",
      },
    };
  }

  async verifyWebhook(request: NextRequest): Promise<WebhookResult | null> {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    const providerPaymentId = String(body?.providerPaymentId ?? "");
    if (!providerPaymentId) return null;
    const eventType = String(body?.eventType ?? "payment.succeeded");
    if (!["payment.succeeded", "payment.refunded"].includes(eventType)) return null;
    return { eventType: eventType as WebhookResult["eventType"], providerPaymentId };
  }
}

const GATEWAYS: Record<string, PaymentGateway> = {
  dev: new DevGateway(),
};

export function getGateway(provider: string): PaymentGateway {
  return GATEWAYS[provider] ?? GATEWAYS.dev;
}

export async function verifyPayment(purchase: { provider: string }, request: NextRequest) {
  const gateway = getGateway(purchase.provider);
  return gateway.verifyWebhook(request);
}