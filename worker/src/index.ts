import { Env, HttpError, json } from "./env";
import * as paypal from "./paypal";
import * as channel3 from "./channel3";
import * as agent from "./agent";
import * as db from "./db";
import * as commerce from "./commerce";
import * as watch from "./watch";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, detail: e.detail }, e.status);
      console.error(e);
      return json({ error: "internal", detail: String(e) }, 500);
    }
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(watch.runAll(env).then((r) => console.log("price watch", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;

function userOf(req: Request): string {
  return req.headers.get("x-user-id") || "anonymous";
}

function requireAppKey(req: Request, env: Env) {
  if (req.headers.get("x-app-key") !== env.APP_KEY) throw new HttpError(401, "bad app key");
}

async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;

  if (p === "/health") return json({ ok: true, env: env.PAYPAL_ENV });

  // Browser lands here after approving a PayPal order. We capture, then bounce back into the app.
  if (p === "/paypal/return" && req.method === "GET") {
    const token = url.searchParams.get("token"); // PayPal order id
    const cancelled = url.searchParams.get("cancelled");
    if (cancelled || !token) return redirectToApp(env, { status: "cancelled" });
    const captured = await commerce.completeApproved(env, token);
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
    const { orderId, trackingNumber, carrier } = (await req.json()) as { orderId: string; trackingNumber: string; carrier?: string };
    const row = await db.getOrder(env, orderId);
    if (!row?.capture_id) throw new HttpError(404, "order not captured");
    const r = await paypal.addTracking(env, orderId, row.capture_id, trackingNumber, carrier);
    await db.updateOrder(env, orderId, { status: "SHIPPED", trackingNumber });
    return json(r);
  }

  const uid = userOf(req);

  if (p === "/me" && req.method === "GET") {
    const u = await db.ensureUser(env, uid);
    return json({ userId: u.id, walletSaved: !!u.vault_id, rules: await db.getRules(env, uid), monthSpent: await db.monthSpent(env, uid) });
  }
  if (p === "/rules" && req.method === "PUT") {
    const r = (await req.json()) as { auto_under_usd: number; monthly_cap_usd: number };
    await db.ensureUser(env, uid);
    await db.setRules(env, uid, { auto_under_usd: Number(r.auto_under_usd) || 0, monthly_cap_usd: Number(r.monthly_cap_usd) || 0 });
    return json(await db.getRules(env, uid));
  }
  if (p === "/orders" && req.method === "GET") {
    const rows = await db.listOrders(env, uid);
    return json(rows.map((o) => ({ ...o, candidate: db.parseCandidate(o.candidate_json), candidate_json: undefined })));
  }
  if (p === "/watches" && req.method === "GET") {
    const rows = await db.listWatches(env, uid);
    return json(rows.map((w) => ({ ...w, candidate: db.parseCandidate(w.candidate_json), candidate_json: undefined })));
  }
  const cancel = p.match(/^\/watches\/([^/]+)\/cancel$/);
  if (cancel && req.method === "POST") { await db.updateWatch(env, cancel[1], { status: "cancelled" }); return json({ ok: true }); }

  // Approve a watch that the rules parked (needs_approval): returns a PayPal approval URL.
  const approve = p.match(/^\/watches\/([^/]+)\/approve$/);
  if (approve && req.method === "POST") {
    const w = await db.getWatch(env, approve[1]);
    if (!w) throw new HttpError(404, "no such watch");
    const c = { ...db.parseCandidate(w.candidate_json), price: w.last_price ?? undefined } as any;
    const pr = await commerce.buy(env, uid, c, "approved", { force: "approve" });
    await db.updateWatch(env, w.id, { status: "bought", orderId: pr.orderId });
    return json({ orderId: pr.orderId, approveUrl: pr.approveUrl });
  }

  // DEBUG ONLY (sandbox): run the real watch evaluation with a forced price, so the demo can show
  // an unattended purchase without waiting for a real price drop.
  const sim = p.match(/^\/debug\/watches\/([^/]+)\/simulate$/);
  if (sim && req.method === "POST" && env.PAYPAL_ENV === "sandbox") {
    const w = await db.getWatch(env, sim[1]);
    if (!w) throw new HttpError(404, "no such watch");
    const body = (await req.json().catch(() => ({}))) as { price?: number };
    return json(await watch.evaluate(env, w, body.price ?? w.target_price));
  }
  if (p === "/debug/watches/run" && req.method === "POST" && env.PAYPAL_ENV === "sandbox") return json(await watch.runAll(env));

  if (p === "/channel3/search" && req.method === "POST") {
    const input = (await req.json()) as channel3.SearchInput & { raw?: boolean };
    return json(input.raw ? await channel3.search(env, input) : await channel3.searchCandidates(env, input));
  }

  if (p === "/agent" && req.method === "POST") {
    const body = (await req.json()) as agent.AgentRequest;
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter();
    const enc = new TextEncoder();
    const emit = async (e: agent.AgentEvent) => { await w.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); };
    ctx.waitUntil((async () => {
      try { await agent.run(env, body, emit); }
      catch (e) { await emit({ type: "error", text: String(e) }); }
      finally { await emit({ type: "done" }); await w.close(); }
    })());
    return new Response(readable, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
  }

  return json({ error: "not found" }, 404);
}

function redirectToApp(env: Env, params: Record<string, string>): Response {
  const q = new URLSearchParams(params).toString();
  const deep = `${env.APP_RETURN_SCHEME}://paypal/return?${q}`;
  const html = `<!doctype html><meta charset="utf-8"><title>Gofer</title>
<meta http-equiv="refresh" content="0;url=${deep}">
<body style="font-family:-apple-system,system-ui;padding:32px;text-align:center">
<p>Returning to Gofer…</p><p><a href="${deep}">Open Gofer</a></p>
<pre style="color:#888">${q}</pre></body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
