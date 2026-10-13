import { Env, HttpError, json } from "./env";
import * as paypal from "./paypal";
import * as channel3 from "./channel3";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, detail: e.detail }, e.status);
      console.error(e);
      return json({ error: "internal", detail: String(e) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function requireAppKey(req: Request, env: Env) {
  if (req.headers.get("x-app-key") !== env.APP_KEY) throw new HttpError(401, "bad app key");
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;

  if (p === "/health") return json({ ok: true, env: env.PAYPAL_ENV });

  // Browser lands here after approving a PayPal order. We capture, then bounce back into the app.
  if (p === "/paypal/return" && req.method === "GET") {
    const token = url.searchParams.get("token"); // PayPal order id
    const cancelled = url.searchParams.get("cancelled");
    if (cancelled || !token) return redirectToApp(env, { status: "cancelled" });
    const captured = await paypal.captureOrder(env, token);
    return redirectToApp(env, { status: captured.status, order: captured.id });
  }

  if (p === "/paypal/webhook" && req.method === "POST") {
    // Week 2: verify signature (PAYPAL-TRANSMISSION-*) and persist events.
    console.log("webhook", await req.text());
    return json({ received: true });
  }

  // Everything below is app-only.
  requireAppKey(req, env);

  if (p === "/paypal/orders" && req.method === "POST") {
    const body = (await req.json()) as paypal.CreateOrderInput;
    const order = await paypal.createOrder(env, body);
    return json({ id: order.id, status: order.status, approve: paypal.approveLink(order), order });
  }

  const cap = p.match(/^\/paypal\/orders\/([^/]+)\/capture$/);
  if (cap && req.method === "POST") return json(await paypal.captureOrder(env, cap[1]));

  const get = p.match(/^\/paypal\/orders\/([^/]+)$/);
  if (get && req.method === "GET") return json(await paypal.getOrder(env, get[1]));

  if (p === "/paypal/tracking" && req.method === "POST") {
    const { orderId, captureId, trackingNumber, carrier } = (await req.json()) as { orderId: string; captureId: string; trackingNumber: string; carrier?: string };
    return json(await paypal.addTracking(env, orderId, captureId, trackingNumber, carrier));
  }

  if (p === "/channel3/search" && req.method === "POST") {
    const input = (await req.json()) as channel3.SearchInput & { raw?: boolean };
    return json(input.raw ? await channel3.search(env, input) : await channel3.searchCandidates(env, input));
  }

  if (p === "/agent" && req.method === "POST") {
    // Week 2: Claude tool loop (channel3_search, rules_check, paypal_create_order, paypal_capture_order, paypal_add_tracking) with SSE.
    return json({ error: "not implemented yet" }, 501);
  }

  return json({ error: "not found" }, 404);
}

function redirectToApp(env: Env, params: Record<string, string>): Response {
  const q = new URLSearchParams(params).toString();
  const deep = `${env.APP_RETURN_SCHEME}://paypal/return?${q}`;
  const html = `<!doctype html><meta charset="utf-8"><title>Errand</title>
<meta http-equiv="refresh" content="0;url=${deep}">
<body style="font-family:-apple-system,system-ui;padding:32px;text-align:center">
<p>Returning to Errand…</p><p><a href="${deep}">Open Errand</a></p>
<pre style="color:#888">${q}</pre></body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
