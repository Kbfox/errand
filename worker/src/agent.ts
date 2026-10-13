import { Env } from "./env";
import * as llm from "./llm";
import * as channel3 from "./channel3";
import * as paypal from "./paypal";

export interface AgentRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  candidates?: channel3.Candidate[];   // what the app already shows, so the agent can refer to ids across turns
  userId?: string;
}

export type AgentEvent =
  | { type: "status"; text: string }
  | { type: "candidates"; items: channel3.Candidate[] }
  | { type: "message"; text: string }
  | { type: "checkout"; orderId: string; approveUrl: string; candidate: channel3.Candidate }
  | { type: "error"; text: string }
  | { type: "done" };

const SYSTEM = `You are Errand, a shopping agent inside an iPhone app. You buy things for the user with PayPal.

Rules:
- First understand the need. If the request is clear enough to search, call search_products right away; do not ask more than one clarifying question.
- After searching, check every result against the user's hard constraints (price cap, wired/wireless, size, colour...). Drop results that violate them. Use the "attributes" and "features" fields, not just the title.
- Present at most 3 candidates by calling present_candidates with the ids and a one-sentence reason each that names a trade-off (e.g. "cheapest, but ABS keycaps"). Then write a short message asking which one to buy.
- When the user picks one, call start_checkout with its id. Never call start_checkout before the user has chosen.
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
    description: "Create a PayPal order for one product the user has chosen. Returns an approval URL the app will open.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

export async function run(env: Env, req: AgentRequest, emit: (e: AgentEvent) => Promise<void>): Promise<void> {
  const known = new Map<string, channel3.Candidate>();
  for (const c of req.candidates ?? []) known.set(c.id, c);

  const messages: llm.Message[] = [{ role: "system", content: SYSTEM }, ...req.messages.map((m) => ({ role: m.role, content: m.content }) as llm.Message)];
  if (known.size) messages.splice(1, 0, { role: "system", content: `Products currently shown to the user (id: title, price): ` + [...known.values()].map((c) => `${c.id}: ${c.title} $${c.price}`).join("; ") });

  for (let step = 0; step < 6; step++) {
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
          const a = call.arguments as { query: string; max_price?: number; min_price?: number; limit?: number };
          await emit({ type: "status", text: `Searching: ${a.query}` });
          const found = await channel3.searchCandidates(env, {
            query: a.query,
            limit: a.limit ?? 8,
            filters: { availability: ["InStock"], ...(a.max_price || a.min_price ? { price: { max_price: a.max_price, min_price: a.min_price } } : {}) },
          }, req.userId);
          for (const c of found) known.set(c.id, c);
          result = found.map(({ buyUrl, image, ...rest }) => rest); // keep the prompt small
        } else if (call.name === "present_candidates") {
          const picks = ((call.arguments as any).picks ?? []) as { id: string; reason: string }[];
          const items = picks.map((p) => known.get(p.id)).filter((c): c is channel3.Candidate => !!c).slice(0, 3)
            .map((c, i) => ({ ...c, reason: picks[i]?.reason }));
          await emit({ type: "candidates", items });
          result = { shown: items.map((c) => c.id) };
        } else if (call.name === "start_checkout") {
          const c = known.get((call.arguments as any).id);
          if (!c) throw new Error("unknown product id");
          await emit({ type: "status", text: `Creating PayPal order for ${c.title}` });
          const order = await paypal.createOrder(env, {
            items: [{ name: c.title.slice(0, 127), unit_amount: { currency_code: c.currency, value: c.price.toFixed(2) }, quantity: "1", sku: c.id, url: c.buyUrl }],
            currency: c.currency,
            vault: true,
          });
          const approveUrl = paypal.approveLink(order);
          if (!approveUrl) throw new Error("no approve link");
          await emit({ type: "checkout", orderId: order.id, approveUrl, candidate: c });
          result = { orderId: order.id, status: order.status };
        } else {
          result = { error: `unknown tool ${call.name}` };
        }
      } catch (e) {
        result = { error: String(e) };
        await emit({ type: "error", text: String(e) });
      }
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: JSON.stringify(result).slice(0, 12000) });
    }
  }
  await emit({ type: "message", text: "I got stuck. Try rephrasing what you need." });
}
