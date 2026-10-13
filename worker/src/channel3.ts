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

async function c3<T>(env: Env, path: string, body: unknown, userId?: string, attempt = 0): Promise<T> {
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
  if (res.status >= 500 && attempt < 2) {
    // Channel3 returns intermittent 500s for requests that succeed on retry (observed 2026-10-13).
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    return c3<T>(env, path, body, userId, attempt + 1);
  }
  if (!res.ok) throw new HttpError(502, `channel3 ${path} -> ${res.status}`, text);
  return JSON.parse(text) as T;
}

export function search(env: Env, input: SearchInput, userId?: string): Promise<unknown> {
  return c3(env, "/search", { limit: 10, ...input }, userId);
}

// ---- Response model (observed from a real /v1/search call, 2026-10-13) ----
export interface C3Product {
  id: string;
  title: string;
  description?: string;
  brands?: { id: string; name: string }[];
  images?: { url: string; cleaned_url?: string; is_main_image?: boolean }[];
  category?: { slug: string; title: string };
  key_features?: string[];
  offers?: {
    url: string;
    domain: string;
    price: { price: number; compare_at_price?: number | null; currency: string };
    availability: string;
    condition?: string;
  }[];
  structured_attributes?: Record<string, string[]>;
  ratings?: unknown;
}

export interface SearchResponse {
  products: C3Product[];
  next_page_token?: string;
}

/** What the agent sees and what the app renders: small, flat, enough to explain a choice. */
export interface Candidate {
  id: string;
  title: string;
  brand?: string;
  price: number;
  compareAt?: number;
  currency: string;
  store: string;
  availability: string;
  image?: string;
  buyUrl: string;
  features: string[];
  attributes: Record<string, string>;
}

export function toCandidate(p: C3Product): Candidate | null {
  const offer = (p.offers ?? []).filter((o) => o.availability === "InStock").sort((a, b) => a.price.price - b.price.price)[0] ?? p.offers?.[0];
  if (!offer) return null;
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.structured_attributes ?? {}).slice(0, 8)) attrs[k] = v.join(", ");
  return {
    id: p.id,
    title: p.title,
    brand: p.brands?.[0]?.name,
    price: offer.price.price,
    compareAt: offer.price.compare_at_price ?? undefined,
    currency: offer.price.currency,
    store: offer.domain,
    availability: offer.availability,
    image: (p.images?.find((i) => i.is_main_image) ?? p.images?.[0])?.cleaned_url ?? p.images?.[0]?.url,
    buyUrl: offer.url,
    features: (p.key_features ?? []).slice(0, 4),
    attributes: attrs,
  };
}

export async function searchCandidates(env: Env, input: SearchInput, userId?: string): Promise<Candidate[]> {
  const res = (await search(env, input, userId)) as SearchResponse;
  return res.products.map(toCandidate).filter((c): c is Candidate => c !== null);
}

export async function productDetail(env: Env, productId: string): Promise<C3Product> {
  const res = await fetch(`${env.CHANNEL3_BASE_URL}/products/${encodeURIComponent(productId)}`, {
    headers: { "x-api-key": env.CHANNEL3_API_KEY },
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(502, `channel3 product ${productId} -> ${res.status}`, text);
  return JSON.parse(text) as C3Product;
}

/** Subscribe Channel3's own price tracker too (webhook-based); harmless if it fails. */
export async function startTracking(env: Env, productId: string): Promise<void> {
  try {
    await fetch(`${env.CHANNEL3_BASE_URL.replace(/\/v1$/, "/v0")}/price-tracking/start`, {
      method: "POST",
      headers: { "x-api-key": env.CHANNEL3_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ canonical_product_id: productId }),
    });
  } catch { /* best effort */ }
}
