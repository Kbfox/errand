import { Env } from "./env";
import type { Candidate } from "./channel3";

export interface Rules { auto_under_usd: number; monthly_cap_usd: number }
export interface UserRow { id: string; vault_id: string | null; vault_customer_id: string | null }
export interface OrderRow {
  id: string; user_id: string; candidate_json: string; amount: number; currency: string;
  status: string; mode: "approved" | "auto" | "watch"; capture_id: string | null; tracking_number: string | null; created_at: string; updated_at: string;
}
export interface WatchRow {
  id: string; user_id: string; product_id: string; candidate_json: string; target_price: number; last_price: number | null;
  status: "active" | "bought" | "needs_approval" | "cancelled"; order_id: string | null; created_at: string; checked_at: string | null;
}

export async function ensureUser(env: Env, id: string): Promise<UserRow> {
  await env.DB.prepare("INSERT OR IGNORE INTO users (id) VALUES (?)").bind(id).run();
  await env.DB.prepare("INSERT OR IGNORE INTO rules (user_id) VALUES (?)").bind(id).run();
  return (await env.DB.prepare("SELECT id, vault_id, vault_customer_id FROM users WHERE id = ?").bind(id).first<UserRow>())!;
}

export async function saveVault(env: Env, userId: string, vaultId: string, customerId?: string) {
  await env.DB.prepare("UPDATE users SET vault_id = ?, vault_customer_id = ? WHERE id = ?").bind(vaultId, customerId ?? null, userId).run();
}

export async function getRules(env: Env, userId: string): Promise<Rules> {
  const r = await env.DB.prepare("SELECT auto_under_usd, monthly_cap_usd FROM rules WHERE user_id = ?").bind(userId).first<Rules>();
  return r ?? { auto_under_usd: 0, monthly_cap_usd: 0 };
}

export async function setRules(env: Env, userId: string, r: Rules) {
  await env.DB.prepare("INSERT INTO rules (user_id, auto_under_usd, monthly_cap_usd, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET auto_under_usd = excluded.auto_under_usd, monthly_cap_usd = excluded.monthly_cap_usd, updated_at = excluded.updated_at")
    .bind(userId, r.auto_under_usd, r.monthly_cap_usd).run();
}

export async function monthSpent(env: Env, userId: string): Promise<number> {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM orders WHERE user_id = ? AND status IN ('COMPLETED','SHIPPED') AND created_at >= date('now','start of month')").bind(userId).first<{ s: number }>();
  return r?.s ?? 0;
}

export async function insertOrder(env: Env, o: { id: string; userId: string; candidate: Candidate; amount: number; currency: string; status: string; mode: OrderRow["mode"]; captureId?: string }) {
  await env.DB.prepare("INSERT INTO orders (id, user_id, candidate_json, amount, currency, status, mode, capture_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(o.id, o.userId, JSON.stringify(o.candidate), o.amount, o.currency, o.status, o.mode, o.captureId ?? null).run();
}

export async function updateOrder(env: Env, id: string, fields: { status?: string; captureId?: string; trackingNumber?: string }) {
  const sets: string[] = ["updated_at = datetime('now')"]; const vals: unknown[] = [];
  if (fields.status) { sets.push("status = ?"); vals.push(fields.status); }
  if (fields.captureId) { sets.push("capture_id = ?"); vals.push(fields.captureId); }
  if (fields.trackingNumber) { sets.push("tracking_number = ?"); vals.push(fields.trackingNumber); }
  vals.push(id);
  await env.DB.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
}

export async function getOrder(env: Env, id: string): Promise<OrderRow | null> {
  return env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
}

export async function listOrders(env: Env, userId: string): Promise<OrderRow[]> {
  return (await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all<OrderRow>()).results;
}

export async function insertWatch(env: Env, w: { id: string; userId: string; candidate: Candidate; targetPrice: number }) {
  await env.DB.prepare("INSERT INTO watches (id, user_id, product_id, candidate_json, target_price, last_price) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(w.id, w.userId, w.candidate.id, JSON.stringify(w.candidate), w.targetPrice, w.candidate.price).run();
}

export async function listWatches(env: Env, userId: string): Promise<WatchRow[]> {
  return (await env.DB.prepare("SELECT * FROM watches WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all<WatchRow>()).results;
}

export async function activeWatches(env: Env): Promise<WatchRow[]> {
  return (await env.DB.prepare("SELECT * FROM watches WHERE status = 'active' ORDER BY created_at LIMIT 200").all<WatchRow>()).results;
}

export async function getWatch(env: Env, id: string): Promise<WatchRow | null> {
  return env.DB.prepare("SELECT * FROM watches WHERE id = ?").bind(id).first<WatchRow>();
}

export async function updateWatch(env: Env, id: string, fields: { status?: WatchRow["status"]; lastPrice?: number; orderId?: string }) {
  const sets: string[] = ["checked_at = datetime('now')"]; const vals: unknown[] = [];
  if (fields.status) { sets.push("status = ?"); vals.push(fields.status); }
  if (fields.lastPrice !== undefined) { sets.push("last_price = ?"); vals.push(fields.lastPrice); }
  if (fields.orderId) { sets.push("order_id = ?"); vals.push(fields.orderId); }
  vals.push(id);
  await env.DB.prepare(`UPDATE watches SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
}

export const parseCandidate = (json: string) => JSON.parse(json) as Candidate;
