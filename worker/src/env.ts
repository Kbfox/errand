export interface Env {
  PAYPAL_ENV: "sandbox" | "live";
  CHANNEL3_BASE_URL: string;
  PUBLIC_BASE_URL: string;
  APP_RETURN_SCHEME: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  CHANNEL3_API_KEY: string;
  LLM_PROVIDER: "workers-ai" | "openai-compatible";
  LLM_MODEL: string;
  LLM_BASE_URL: string;
  LLM_API_KEY?: string;
  AI: Ai;
  APP_KEY: string;
  APNS_KEY?: string;          // contents of the .p8 (secret)
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
  APNS_TOPIC: string;         // bundle id
  APNS_ENV: "sandbox" | "production";
  DB: D1Database;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}
