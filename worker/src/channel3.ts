import { Env, HttpError } from "./env";

// NOTE: endpoint shape to be confirmed against docs.trychannel3.com in week 1.
export interface SearchInput {
  query?: string;
  image_url?: string;
  url?: string;
  limit?: number;
  filters?: { price?: { min?: number; max?: number }; brands?: string[]; category?: string };
}

export async function search(env: Env, input: SearchInput): Promise<unknown> {
  const res = await fetch(`${env.CHANNEL3_BASE_URL}/search`, {
    method: "POST",
    headers: { "x-api-key": env.CHANNEL3_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ limit: 10, ...input }),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(502, `channel3 search -> ${res.status}`, text);
  return JSON.parse(text);
}
