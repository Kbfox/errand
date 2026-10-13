# Gofer

> **Tell it what you need. It finds it, you approve, it pays.**

Gofer is an iPhone shopping agent built for the **PayPal AI Hackathon 2026**. You describe what you want in plain language. The agent searches real products across retailers, explains the trade-offs, and pays with PayPal. Set spending rules once and it can buy on your behalf without asking: within your limits, or the moment a price you are watching drops.

It does not recommend and stop. It transacts.

<!-- demo video: add YouTube link before submission -->
**Demo video:** _coming in week 4_ · **TestFlight:** https://testflight.apple.com/join/wfkdTAhA (iOS 17+, Beta App Review pending) · **Backend:** https://gofer.kbfoxtk.workers.dev/health

---

## What it does

| Step | What happens | PayPal / partner API |
|---|---|---|
| 1. Say what you need | "Wired mechanical keyboard, blue switches, under $120" | |
| 2. Agent finds it | Searches real inventory across retailers, checks each result against your hard constraints using structured attributes, shortlists 3 with a one-line trade-off each | Channel3 `POST /v1/search` |
| 3. You approve | Tap **Buy with PayPal**. The PayPal sheet opens inside the app; you pay with your PayPal account | Orders v2 `create` → `capture`, wallet vaulted with `store_in_vault: ON_SUCCESS` |
| 4. Next time it just buys | Under your auto-buy limit and monthly cap, Gofer charges your saved PayPal wallet with no sheet | Orders v2 with `payment_source.paypal.vault_id` (auto-captured) |
| 5. Watch a price | "Buy it automatically if it drops under $60." A cron re-checks the price; when it hits, Gofer buys unattended, still inside your rules | Channel3 `GET /v1/products/{id}` + price tracking, Orders v2 vault charge |
| 6. Track it | Orders tab shows every purchase, how it was authorised, and shipment status | Orders v2 `/track` |
| 7. Show it a photo or a link | Snap a product or paste a URL; Gofer identifies it and offers to buy | Channel3 `/v1/image-search`, `/v1/lookup` |
| 8. Get told | A push arrives when a watched price hits and Gofer buys, or when a purchase needs your approval | APNs (provider token from the Worker) |

### Spending rules are enforced by the server, not the model

The LLM proposes; the backend disposes. Every purchase goes through `commerce.decide()`:

```
no saved wallet            → open PayPal for approval
auto-buy limit is 0        → open PayPal for approval
price > auto-buy limit     → open PayPal for approval
would exceed monthly cap   → open PayPal for approval
otherwise                  → charge the vaulted wallet, no approval
```

Price watches run through the same function. If a watched price hits but the rules say no, the watch is parked as **needs approval** and the Orders tab offers a one-tap PayPal approval instead.

### Money only moves on an explicit user choice

Independently of the prompt, the agent loop refuses `start_checkout` unless the user's latest message selects the product (the app's tap sends `(id …)`) or contains a purchase verb, and never in the same turn in which candidates were presented. This guard exists because, during development, a single-candidate result led the model to skip the question and buy. It cannot do that now.

---

## Architecture

```
iPhone app (SwiftUI, iOS 17+)                 Cloudflare Worker (TypeScript)
┌──────────────────────────────┐              ┌──────────────────────────────────────────┐
│ Gofer tab   chat + cards    │  POST /agent │ agent.ts   tool loop on Workers AI        │
│ Orders tab   orders, watches │ ───(SSE)───▶ │   search_products → Channel3              │
│ Rules tab    limits, wallet  │              │   present_candidates (filtered, ≤3)       │
│                              │ ◀─────────── │   start_checkout  → commerce.buy()        │
│ CheckoutCoordinator          │   events     │   watch_price     → watches table         │
│   ASWebAuthenticationSession │              │ commerce.ts  rules → vault charge | sheet │
│   gofer://paypal/return     │              │ watch.ts     cron */15 + simulate         │
└──────────────────────────────┘              │ paypal.ts    OAuth, orders, capture, track│
                                              │ channel3.ts  search, detail, tracking     │
                                              │ D1: users · rules · orders · watches      │
                                              └──────────────────────────────────────────┘
                                                   │              │               │
                                              PayPal Sandbox   Channel3 API   Workers AI
                                              (Orders v2,      (products,     (Llama 3.3 70B,
                                               Vault, track)    prices)        tool calling)
```

- **LLM:** Cloudflare Workers AI by default (no API key, free tier). `src/llm.ts` is provider-agnostic; set `LLM_PROVIDER=openai-compatible` with `LLM_BASE_URL` and a `LLM_API_KEY` secret to use DeepSeek, OpenAI, Qwen or any compatible endpoint.
- **Agent events** (`status`, `candidates`, `message`, `checkout`, `purchased`, `watching`, `error`, `done`) stream over server-sent events so the UI updates as the agent works.
- **Deterministic guards around the model:** a conflict filter (`constraints.ts`) drops any shortlisted product whose structured attributes contradict the request (wireless when you asked for wired, brown switches when you asked for blue), and the purchase guard in `agent.ts` only lets money move on an explicit user choice.
- **Push:** the Worker signs an ES256 provider token with the team's APNs key and posts to APNs directly; devices register their token at `POST /devices`.
- **Merchant model:** in the sandbox, Gofer itself is the merchant (the PayPal business sandbox account receives the money). Product discovery and buy links come from Channel3; Gofer charges the user through PayPal and records the order.

---

## Run it locally

Prerequisites: Node 20+, Xcode 16+ with an iOS 17 simulator, [XcodeGen](https://github.com/yonaskolb/XcodeGen), a free [PayPal developer](https://developer.paypal.com) account, a free [Channel3](https://trychannel3.com) API key, a Cloudflare account (for Workers AI and D1; `wrangler login`).

### Backend

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars        # fill PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, CHANNEL3_API_KEY, APP_KEY
npx wrangler d1 migrations apply errand --local
npm run dev                           # http://localhost:8787
```

Smoke-test PayPal without the app (create order → approve in a browser → capture):

```bash
./scripts/smoke-paypal.sh
```

### iOS app

```bash
cd ios
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig   # APP_KEY must match the worker's; set your DEVELOPMENT_TEAM
xcodegen generate
open Gofer.xcodeproj                 # run the Gofer scheme on a simulator (keep signing on: push registration needs the aps-environment entitlement)
```

Debug builds talk to `http://localhost:8787`; Release builds talk to the deployed Worker (see `ios/project.yml`).

### Deploy

```bash
cd worker
npx wrangler d1 create errand         # once; put the id in wrangler.toml
npx wrangler d1 migrations apply errand --remote
npm run secrets                       # PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, CHANNEL3_API_KEY, APP_KEY (+ LLM_API_KEY if not Workers AI)
npx wrangler secret put APNS_KEY < AuthKey_XXXX.p8   # optional: enables push; set APNS_KEY_ID / APNS_TEAM_ID / APNS_TOPIC in wrangler.toml
npm run deploy
```

Set `PUBLIC_BASE_URL` in `wrangler.toml` to the deployed URL: PayPal redirects there after approval, and the Worker bounces back into the app via `gofer://paypal/return`.

---

## Testing guide for judges

1. **Pay with PayPal:** pick a suggestion on the Gofer tab, tap **Buy with PayPal** on a card, sign in with a PayPal **sandbox personal** account, tap Pay Now. You land back in the app with a green receipt. Your sandbox wallet is now saved.
2. **Let it buy for you:** Rules tab → *Buy without asking under* **$100** → Save. Ask for something else and tap Buy: the receipt says *Bought for you with PayPal*, no sheet.
3. **Watch a price:** in the chat, type *"Don't buy it now, buy it automatically if it drops under $60"* about a shown product. Orders tab → *Watching*. In a Debug build tap **Simulate price drop**: the real evaluation runs with the price forced to your target and the order appears as *Bought on price drop*. (In production the cron checks every 15 minutes against live prices.)
4. **See the rules bite:** set the limit to **$25** and try again: the PayPal sheet comes back, and the receipt explains why.

All money is PayPal **sandbox**. Sandbox buyer credentials for TestFlight testers are in the Devpost submission notes.

---

## Repository layout

```
worker/
  src/index.ts      routes (/agent SSE, /paypal/return, /me, /rules, /orders, /watches, /debug/…), cron
  src/agent.ts      tool loop, system prompt, purchase guard
  src/commerce.ts   decide() + buy(): rules → vault charge or approval sheet; completeApproved()
  src/watch.ts      price-watch evaluation (cron and simulate share it)
  src/paypal.ts     OAuth token cache, Orders v2 create/capture/get, vault params, /track
  src/channel3.ts   search, product detail, price tracking, Candidate normaliser
  src/llm.ts        Workers AI / OpenAI-compatible chat with tools
  src/db.ts         D1 access
  migrations/       schema
  scripts/          smoke-paypal.sh
ios/
  App/              GoferApp (3 tabs), AppConfig
  Views/            ChatView (cards, receipts), OrdersView, RulesView
  Services/         AgentClient (SSE), APIClient, ChatModel, CheckoutCoordinator (ASWebAuthenticationSession)
  Models/           Candidate, AgentEvent, Order, Watch, Rules
docs/plan.md        product definition and schedule
```

## Hackathon notes

- **PayPal APIs used:** OAuth2, Orders v2 (create, capture, get, track), Vault via `payment_source.paypal.attributes.vault` and `vault_id`, sandbox webhooks endpoint stubbed.
- **Sponsor tool:** Channel3 for product search, structured attributes, cross-retailer offers, product detail and price tracking.
- **AI:** Cloudflare Workers AI (Llama 3.3 70B) with function calling; provider swappable.
- **Built solo in October 2026**, with Claude Code as pair programmer.

## License

MIT, see [LICENSE](LICENSE).
