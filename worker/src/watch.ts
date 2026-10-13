// Price watch: "buy it when it drops under $X". Checked by cron every 15 min against Channel3's
// product detail; the Debug "simulate price drop" endpoint runs the exact same path with a forced price.
import { Env } from "./env";
import * as db from "./db";
import * as channel3 from "./channel3";
import * as commerce from "./commerce";
import * as apns from "./apns";

export async function currentPrice(env: Env, productId: string): Promise<number | null> {
  try {
    const p = await channel3.productDetail(env, productId);
    const c = channel3.toCandidate(p);
    return c?.price ?? null;
  } catch { return null; }
}

export interface WatchOutcome { watchId: string; price: number | null; result: "waiting" | "bought" | "needs_approval" | "error"; orderId?: string; detail?: string }

export async function evaluate(env: Env, w: db.WatchRow, forcedPrice?: number): Promise<WatchOutcome> {
  const price = forcedPrice ?? (await currentPrice(env, w.product_id));
  if (price === null) return { watchId: w.id, price, result: "error", detail: "price unavailable" };
  await db.updateWatch(env, w.id, { lastPrice: price });
  if (price > w.target_price) return { watchId: w.id, price, result: "waiting" };

  const c = { ...db.parseCandidate(w.candidate_json), price };
  try {
    const p = await commerce.buy(env, w.user_id, c, "watch");
    if (p.mode === "auto") {
      await db.updateWatch(env, w.id, { status: "bought", orderId: p.orderId });
      await apns.notifyUser(env, w.user_id, { title: "Bought it for you", body: `${c.title} dropped to $${price.toFixed(2)}. Paid with your PayPal wallet.`, data: { orderId: p.orderId } });
      return { watchId: w.id, price, result: "bought", orderId: p.orderId };
    }
    // Rules did not allow an unattended purchase: park it for the user to approve in the app.
    await db.updateWatch(env, w.id, { status: "needs_approval", orderId: p.orderId });
    await apns.notifyUser(env, w.user_id, { title: "Price hit, your approval needed", body: `${c.title} is $${price.toFixed(2)}. ${p.decision.reason}. Open Gofer to approve.`, data: { watchId: w.id } });
    return { watchId: w.id, price, result: "needs_approval", orderId: p.orderId, detail: p.decision.reason };
  } catch (e) {
    return { watchId: w.id, price, result: "error", detail: String(e) };
  }
}

export async function runAll(env: Env): Promise<WatchOutcome[]> {
  const out: WatchOutcome[] = [];
  for (const w of await db.activeWatches(env)) out.push(await evaluate(env, w));
  return out;
}
