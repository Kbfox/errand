import { Env } from "./env";
import * as llm from "./llm";
import * as channel3 from "./channel3";
import * as commerce from "./commerce";
import * as db from "./db";
import { conflict } from "./constraints";

export interface AgentRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  candidates?: channel3.Candidate[];   // what the app already shows, so the agent can refer to ids across turns
  userId?: string;
}

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "candidates"; items: channel3.Candidate[] }
  | { type: "message"; text: string }
  | { type: "checkout"; orderId: string; approveUrl: string; candidate: channel3.Candidate; reason: string }
  | { type: "purchased"; orderId: string; captureId?: string; candidate: channel3.Candidate; reason: string }
  | { type: "watching"; watchId: string; candidate: channel3.Candidate; targetPrice: number }
  | { type: "error"; text: string }
  | { type: "done" };

const SYSTEM = `You are Errand, a shopping agent inside an iPhone app. You buy things for the user with PayPal.

Rules:
- First understand the need. If the request is clear enough to search, call search_products right away; do not ask more than one clarifying question.
- After searching, check every result against the user's hard constraints (price cap, wired/wireless, size, colour...). Drop results that violate them. Use the "attributes" and "features" fields, not just the title.
- Present at most 3 candidates by calling present_candidates with the ids and a one-sentence reason each that names a trade-off (e.g. "cheapest, but ABS keycaps"). Then write a short message asking which one to buy.
- Never present a product whose reason admits it violates a hard constraint (e.g. "but no blue switches"). Leave it out instead.
- When the user picks one, call start_checkout with its id. Never call start_checkout before the user has chosen.
- If the user says to buy something only when it drops to or under a price ("buy when under $60", "if it hits 50"), call watch_price with that id and target price instead of start_checkout.
- After start_checkout or watch_price returns, reply with one short sentence; the app shows the details.
- Keep messages under 60 words. Prices in USD.`;

const TOOLS: llm.ToolSpec[] = [
  {
    name: "search_products",
    description: "Search real products across retailers.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Concise product search text" },
        max_price: { type: "number", description: "Upper price bound in USD, if the user gave one" },
        min_price: { type: "number" },
        limit: { type: "integer", description: "Default 8" },
      },
      required: ["query"],
    },
  },
  {
    name: "present_candidates",
    description: "Show up to 3 shortlisted products to the user with reasons.",
    parameters: {
      type: "object",
      properties: {
        picks: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" }, reason: { type: "string" } }, required: ["id", "reason"] },
        },
      },
      required: ["picks"],
    },
  },
  {
    name: "start_checkout",
    description: "Buy one product the user has chosen with PayPal. Depending on the user's spending rules this either completes immediately or opens a PayPal approval sheet.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "watch_price",
    description: "Watch a product and buy it automatically when its price drops to or below target_price (USD).",
    parameters: { type: "object", properties: { id: { type: "string" }, target_price: { type: "number" } }, required: ["id", "target_price"] },
  },
];

const NEGATED = /\b(but|however|although|though)?\s*(no|not|without|lacks|lacking|isn't|aren't|doesn't|don't|non-)\b/i;

export async function run(env: Env, req: AgentRequest, emit: (e: AgentEvent) => Promise<void>): Promise<void> {
  const userId = req.userId ?? "anonymous";
  const known = new Map<string, channel3.Candidate>();
  for (const c of req.candidates ?? []) known.set(c.id, c);

  const messages: llm.Message[] = [{ role: "system", content: SYSTEM }, ...req.messages.map((m) => ({ role: m.role, content: m.content }) as llm.Message)];
  if (known.size) messages.splice(1, 0, { role: "system", content: `Products currently shown to the user (id: title, price): ` + [...known.values()].map((c) => `${c.id}: ${c.title} $${c.price}`).join("; ") });

  // Hard guard, independent of the model: money can only move on an explicit user choice.
  // (1) never in the same turn in which candidates were presented; (2) the user's latest message must
  // reference the product (the app's pick message includes "(id XXX)") or contain a purchase verb.
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  let presentedThisTurn = false;
  const userChose = (id: string) => lastUser.includes(id) || /\b(buy|take|order|get|purchase|go with|pick|that one|this one|yes)\b/i.test(lastUser);

  let checkoutStarted = false;
  for (let step = 0; step < 6 && !checkoutStarted; step++) {
    const res = await llm.chat(env, messages, TOOLS);
    if (!res.toolCalls.length) {
      if (res.content.trim()) await emit({ type: "message", text: res.content.trim() });
      return;
    }
    messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls });

    for (const call of res.toolCalls) {
      let result: unknown;
      try {
        if (call.name === "search_products") {
          const raw = call.arguments as { query: string; max_price?: unknown; min_price?: unknown; limit?: unknown };
          const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
          const a = { query: String(raw.query ?? ""), max_price: num(raw.max_price), min_price: num(raw.min_price), limit: num(raw.limit) };
          await emit({ type: "status", text: `Searching: ${a.query}` });
          const found = await channel3.searchCandidates(env, {
            query: a.query,
            limit: a.limit ?? 8,
            filters: { availability: ["InStock"], ...(a.max_price || a.min_price ? { price: { max_price: a.max_price, min_price: a.min_price } } : {}) },
          }, req.userId);
          found.sort((a, b) => a.price - b.price);
          for (const c of found) known.set(c.id, c);
          result = { note: "sorted by price ascending; verify constraints using attributes/features", products: found.map(({ buyUrl, image, ...rest }) => rest) };
        } else if (call.name === "present_candidates") {
          if (presentedThisTurn) {
            result = { refused: true, reason: "Candidates were already shown this turn. Ask the user which one to buy and stop." };
            messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
            continue;
          }
          const picks = ((call.arguments as any).picks ?? []) as { id: string; reason: string }[];
          const firstUser = req.messages.find((m) => m.role === "user")?.content ?? "";
          const rejected: Record<string, string> = {};
          const items = picks
            .filter((p) => known.has(p.id) && !NEGATED.test(p.reason ?? ""))   // model-proof: drop "but no X" picks
            .filter((p) => { const bad = conflict(firstUser, known.get(p.id)!); if (bad) rejected[p.id] = bad; return !bad; })
            .map((p) => ({ ...known.get(p.id)!, reason: p.reason }))
            .slice(0, 3);
          await emit({ type: "candidates", items });
          presentedThisTurn = true;
          result = { shown: items.map((c) => c.id), dropped: picks.length - items.length, rejected_for_conflict: rejected, note: "Now ask the user which one to buy and stop. Do not call start_checkout in this turn." };
        } else if (call.name === "start_checkout") {
          const c = known.get((call.arguments as any).id);
          if (!c) throw new Error("unknown product id");
          if (presentedThisTurn || !userChose(c.id)) {
            result = { refused: true, reason: "The user has not chosen this product yet. Ask which one to buy and wait for the answer." };
            messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
            continue;
          }
          await emit({ type: "status", text: `Checking your rules for ${c.title}` });
          const p = await commerce.buy(env, userId, c);
          if (p.mode === "auto") {
            await emit({ type: "purchased", orderId: p.orderId, captureId: p.captureId, candidate: c, reason: p.decision.reason });
            result = { bought: true, orderId: p.orderId, note: "Purchased automatically within the user's rules. Tell the user in one sentence." };
          } else {
            await emit({ type: "checkout", orderId: p.orderId, approveUrl: p.approveUrl!, candidate: c, reason: p.decision.reason });
            result = { orderId: p.orderId, status: p.status, note: "PayPal approval sheet is opening in the app." };
          }
          checkoutStarted = true; // the app takes over from here; never create a second order in the same turn
        } else if (call.name === "watch_price") {
          const a = { id: String((call.arguments as any).id ?? ""), target_price: Number((call.arguments as any).target_price) };
          if (!Number.isFinite(a.target_price) || a.target_price <= 0) throw new Error("target_price must be a positive number");
          const c = known.get(a.id);
          if (!c) throw new Error("unknown product id");
          if (presentedThisTurn || !/\d/.test(lastUser)) {
            result = { refused: true, reason: "Only watch a price when the user explicitly asked for it with a target price." };
            messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
            continue;
          }
          const id = crypto.randomUUID();
          await db.ensureUser(env, userId);
          await db.insertWatch(env, { id, userId, candidate: c, targetPrice: a.target_price });
          await channel3.startTracking(env, c.id);
          await emit({ type: "watching", watchId: id, candidate: c, targetPrice: a.target_price });
          result = { watching: true, watchId: id, currentPrice: c.price, targetPrice: a.target_price };
          checkoutStarted = true;
        } else {
          result = { error: `unknown tool ${call.name}` };
        }
      } catch (e) {
        // Tool failures go back to the model (it usually retries); the user only sees a status line.
        result = { error: String(e) };
        await emit({ type: "status", text: "Retrying…" });
      }
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(result).slice(0, 12000) });
      if (checkoutStarted) break;
    }
  }
  if (!checkoutStarted) await emit({ type: "message", text: "I got stuck. Try rephrasing what you need." });
}
