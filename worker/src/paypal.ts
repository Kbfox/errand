import { Env, HttpError } from "./env";

const BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

let cached: { token: string; exp: number } | null = null;

export async function accessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cached && cached.exp > now + 60_000) return cached.token;
  const res = await fetch(`${BASE[env.PAYPAL_ENV]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new HttpError(502, "paypal oauth failed", await res.text());
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: now + data.expires_in * 1000 };
  return cached.token;
}

async function pp<T>(env: Env, method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const token = await accessToken(env);
  const res = await fetch(`${BASE[env.PAYPAL_ENV]}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(502, `paypal ${method} ${path} -> ${res.status}`, safeJson(text));
  return (text ? JSON.parse(text) : {}) as T;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return t; }
}

export interface OrderItem {
  name: string;
  unit_amount: { currency_code: string; value: string };
  quantity: string;
  description?: string;
  sku?: string;
  url?: string;
}

export interface CreateOrderInput {
  items: OrderItem[];
  currency?: string;
  referenceId?: string;      // our internal order id
  vault?: boolean;           // ask PayPal to vault the payer's wallet for later unattended charges
  vaultId?: string;          // charge a previously vaulted wallet (no payer approval step)
}

export interface PayPalOrder {
  id: string;
  status: string;
  links?: { rel: string; href: string; method: string }[];
  purchase_units?: unknown[];
  payment_source?: Record<string, unknown>;
}

export function sum(items: OrderItem[]): string {
  const cents = items.reduce((a, i) => a + Math.round(parseFloat(i.unit_amount.value) * 100) * parseInt(i.quantity, 10), 0);
  return (cents / 100).toFixed(2);
}

export async function createOrder(env: Env, input: CreateOrderInput): Promise<PayPalOrder> {
  const currency = input.currency ?? "USD";
  const total = sum(input.items);
  const returnBase = `${env.PUBLIC_BASE_URL}/paypal/return`;

  const paypalSource: Record<string, unknown> = input.vaultId
    ? { vault_id: input.vaultId }
    : {
        experience_context: {
          brand_name: "Errand",
          locale: "en-US",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: returnBase,
          cancel_url: `${returnBase}?cancelled=1`,
        },
        ...(input.vault ? { attributes: { vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" } } } : {}),
      };

  return pp<PayPalOrder>(env, "POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.referenceId ?? crypto.randomUUID(),
        amount: {
          currency_code: currency,
          value: total,
          breakdown: { item_total: { currency_code: currency, value: total } },
        },
        items: input.items,
      },
    ],
    payment_source: { paypal: paypalSource },
  }, { "PayPal-Request-Id": crypto.randomUUID() });
}

export async function captureOrder(env: Env, orderId: string): Promise<PayPalOrder> {
  return pp<PayPalOrder>(env, "POST", `/v2/checkout/orders/${orderId}/capture`, undefined, { "PayPal-Request-Id": crypto.randomUUID() });
}

export async function getOrder(env: Env, orderId: string): Promise<PayPalOrder> {
  return pp<PayPalOrder>(env, "GET", `/v2/checkout/orders/${orderId}`);
}

export function approveLink(order: PayPalOrder): string | undefined {
  return order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
}

// Orders v2 tracking (verified in sandbox 2026-10-13). The older /v1/shipping/trackers-batch
// returns 403 NOT_AUTHORIZED for a default sandbox app, so use this one.
export async function addTracking(env: Env, orderId: string, captureId: string, trackingNumber: string, carrier = "OTHER", carrierNameOther = "Errand courier", notify = true) {
  return pp(env, "POST", `/v2/checkout/orders/${orderId}/track`, {
    capture_id: captureId,
    tracking_number: trackingNumber,
    carrier,
    ...(carrier === "OTHER" ? { carrier_name_other: carrierNameOther } : {}),
    notify_payer: notify,
  });
}
