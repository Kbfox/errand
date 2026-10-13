import { Env, HttpError } from "./env";

// Confirmed against docs.trychannel3.com/guides/make-a-search (2026-10-13):
//   POST https://api.trychannel3.com/v1/search, header x-api-key, optional x-user-id for click attribution.
// Other v1 endpoints exist (image search, product detail, lookup by URL, similar products,
// price tracking start/stop/history) — wire them in week 2/3 once a key is available.
export interface SearchInput {
  query: string;
  limit?: number;
  filters?: {
    price?: { min_price?: number; max_price?: number };
    availability?: ("InStock" | "OutOfStock" | "PreOrder")[];
    brand_ids?: string[];
    website_ids?: string[];
    category?: string;
  };
}

async function c3<T>(env: Env, path: string, body: unknown, userId?: string): Promise<T> {
  const res = await fetch(`${env.CHANNEL3_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "x-api-key": env.CHANNEL3_API_KEY,
      "content-type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(502, `channel3 ${path} -> ${res.status}`, text);
  return JSON.parse(text) as T;
}

export function search(env: Env, input: SearchInput, userId?: string): Promise<unknown> {
  return c3(env, "/search", { limit: 10, ...input }, userId);
}
