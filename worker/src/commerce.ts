// The part that makes Errand an agent rather than a chat front-end for a cart:
// server-side spending rules decide whether a purchase happens unattended (vaulted PayPal wallet)
// or needs the user's approval in the PayPal sheet. The LLM never gets to skip this.
import { Env } from "./env";
import * as db from "./db";
import * as paypal from "./paypal";
import type { Candidate } from "./channel3";

export type Decision =
  | { kind: "auto"; reason: string }
  | { kind: "approve"; reason: string };

export async function decide(env: Env, userId: string, price: number): Promise<Decision> {
  const user = await db.ensureUser(env, userId);
  const rules = await db.getRules(env, userId);
  if (!user.vault_id) return { kind: "approve", reason: "No saved PayPal wallet yet" };
  if (rules.auto_under_usd <= 0) return { kind: "approve", reason: "Auto-buy is off" };
  if (price > rules.auto_under_usd) return { kind: "approve", reason: `Over your $${rules.auto_under_usd} auto-buy limit` };
  if (rules.monthly_cap_usd > 0) {
    const spent = await db.monthSpent(env, userId);
    if (spent + price > rules.monthly_cap_usd) return { kind: "approve", reason: `Would exceed your $${rules.monthly_cap_usd} monthly cap ($${spent.toFixed(2)} spent)` };
  }
  return { kind: "auto", reason: `Within your $${rules.auto_under_usd} auto-buy limit` };
}

export interface Purchase {
  orderId: string;
  status: string;
  captureId?: string;
  approveUrl?: string;
  mode: "auto" | "approved";
  decision: Decision;
}

/** Buy `c` for `userId`, unattended if the rules allow it, otherwise return an approval URL. */
export async function buy(env: Env, userId: string, c: Candidate, mode: "approved" | "auto" | "watch" = "approved", opts: { force?: "approve" } = {}): Promise<Purchase> {
  const decision: Decision = opts.force === "approve" ? { kind: "approve", reason: "User asked to approve" } : await decide(env, userId, c.price);
  const user = await db.ensureUser(env, userId);
  const item = { name: c.title.slice(0, 127), unit_amount: { currency_code: c.currency, value: c.price.toFixed(2) }, quantity: "1", sku: c.id, url: c.buyUrl };

  if (decision.kind === "auto" && user.vault_id) {
    const order = await paypal.createOrder(env, { items: [item], currency: c.currency, vaultId: user.vault_id });
    const captureId = captureIdOf(order);
    await db.insertOrder(env, { id: order.id, userId, candidate: c, amount: c.price, currency: c.currency, status: order.status, mode: mode === "watch" ? "watch" : "auto", captureId });
    return { orderId: order.id, status: order.status, captureId, mode: "auto", decision };
  }

  const order = await paypal.createOrder(env, { items: [item], currency: c.currency, vault: true, referenceId: userId });
  await db.insertOrder(env, { id: order.id, userId, candidate: c, amount: c.price, currency: c.currency, status: "CREATED", mode: "approved" });
  return { orderId: order.id, status: order.status, approveUrl: paypal.approveLink(order), mode: "approved", decision };
}

/** Called from /paypal/return: capture, persist, and remember the vaulted wallet for next time. */
export async function completeApproved(env: Env, orderId: string) {
  const captured = await paypal.captureOrder(env, orderId);
  const row = await db.getOrder(env, orderId);
  const captureId = captureIdOf(captured);
  if (row) {
    await db.updateOrder(env, orderId, { status: captured.status, captureId });
    const vault = (captured.payment_source as any)?.paypal?.attributes?.vault;
    if (vault?.id && vault.status === "VAULTED") await db.saveVault(env, row.user_id, vault.id, vault.customer?.id);
  }
  return captured;
}

export function captureIdOf(order: paypal.PayPalOrder): string | undefined {
  return (order.purchase_units as any)?.[0]?.payments?.captures?.[0]?.id;
}
