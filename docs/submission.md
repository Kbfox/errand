# Gofer — Devpost submission kit (PayPal AI Hackathon 2026)

Deadline: **Nov 12, 2026 12:00 PT** (Beijing Nov 13 04:00). Target: submit **Nov 10**.
Submission page: https://paypalaihackathon.devpost.com → Enter a Submission.

---

## 1. Demo video (≤ 3:00, target 2:30)

**Re-record after the Gofer rename and UI pass (orange icon, new home, chips, Settings, push).** Build with signing on so the push banner appears. Record on the iPhone 18 Pro simulator (Gofer-only device `250FDF0D-DF15-4DC0-B569-B17ACF39C22A`), Debug build so the **Simulate price drop** button exists. Fix the clock first: `xcrun simctl status_bar 250FDF0D-DF15-4DC0-B569-B17ACF39C22A override --time 9:41`. Record with `xcrun simctl io <udid> recordVideo --codec h264 ~/Desktop/errand-demo.mov`, trim with ffmpeg. Narration recorded separately (or captions), English.

Before recording: fresh install (new user id), Rules = Always ask, log in to the PayPal sandbox once in a throwaway run so the ASWebAuthenticationSession "Gofer wants to use sandbox.paypal.com" dialog has already been accepted and PayPal cookies exist. Keep the local Worker running.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:12 | App icon → empty chat | "This is Gofer. You tell it what you need. It finds it, you approve, it pays. With PayPal." |
| 0:12–0:20 | Tap the camera, pick a product photo → "Looking at your photo" → 3 lookalikes | "Or just show it a photo." (optional shot, cut if over time) |
| 0:20–0:40 | Tap suggestion "Wired mechanical keyboard, blue switches, under $120" → status line → 3 cards appear | "The agent searches real inventory across retailers through Channel3, checks every result against the hard constraints using structured attributes, not just titles, and shortlists three. Each card says what you give up." |
| 0:40–1:05 | Tap **Buy with PayPal** on one → PayPal sheet (already signed in) → Pay Now → back in app → green receipt | "You approve the first purchase in PayPal, inside the app. Gofer captures the order and, with your consent, saves the wallet for next time." |
| 1:05–1:25 | Rules tab → set *Buy without asking under* $100, cap $500 → Save; show "PayPal wallet: Saved" | "Now the agent gets a budget. These rules live on the server. The model can't talk its way around them." |
| 1:25–1:50 | Gofer tab → "Running shoes for wide feet, size 10, under $90" → tap Buy → receipt "Bought for you with PayPal · No approval needed: within your $100 auto-buy limit" | "Under the limit, Gofer charges the saved PayPal wallet directly. No sheet. That's the difference between an assistant that recommends and an agent that transacts." |
| 1:50–2:20 | Type "Don't buy the X now. Buy it automatically if it drops under $60." → Watching card → Orders tab → Watching row → tap **Simulate price drop** → **push banner "Bought it for you"** → row becomes order "Bought on price drop" | "Or give it a condition. Gofer subscribes to the price and checks it every fifteen minutes. The moment it hits, it buys, still inside your rules, and tells you. Here I'm forcing the price so you can see the real code path run." |
| 2:20–2:40 | Rules → set limit to $25 → Buy something at $45 → PayPal sheet comes back → receipt "You approved it: over your $25 auto-buy limit" | "Change the rules and the agent asks again. Every purchase shows how it was authorised." |
| 2:40–2:55 | Orders tab scroll; quick cut to code: `commerce.ts decide()` and the guard in `agent.ts` | "Spending rules and the 'user must choose' guard are enforced server-side. Built solo on SwiftUI, Cloudflare Workers, Workers AI, PayPal Orders v2 and Vault, and Channel3." |
| 2:55–3:00 | End card: Gofer · github.com/Kbfox/gofer | |

Shot rules: no third-party music; product images come from Channel3 results (retailer catalogue imagery), keep them small and in context; show the PayPal sandbox banner, do not crop it (judges should see it is sandbox).

---

### Recording log (2026-10-13)
Raw take: `~/Desktop/errand-video/raw.mov` (414 s, simctl recordVideo, VFR). Timestamps in the raw file are irregular, so **first transcode to CFR** (`ffmpeg -i raw.mov -vf fps=30,scale=1080:-2 cfr.mp4`) and cut from that; seeking the raw file lands on wrong frames. Cut list on the CFR timeline (seconds): `0-5, 12.5-29, 52.5-63.5, 92.5-127.5, 171-181, 209-223, 239-253, 275.5-282, 299.5-319.5, 334.5-347.5, 353.5-360.5, 367.5-376.5` → `Gofer-demo.mp4`, 161 s, 1080×2346, no audio yet. Known soft spots: the first PayPal sheet was barely captured by the recorder (dialog → receipt), the second purchase shows the full PayPal page; the Orders page did not refresh in time after Simulate, the result shows on the final Orders screen. Narration/captions still to add (script above).

## 2. Devpost fields

**Project name:** Gofer

**Tagline (≤ 60 chars):** Tell it what you need. It finds it, you approve, it pays.

**Built with (tags):** swift, swiftui, ios, cloudflare-workers, cloudflare-d1, workers-ai, typescript, paypal, paypal-orders-api, paypal-vault, channel3, llama

**Try it out links:** GitHub `https://github.com/Kbfox/gofer` · TestFlight `<link>` · Backend health `https://gofer.kbfoxtk.workers.dev/health`

**Video:** `<YouTube link>`

**Primary category / prizes to tick:** Grand Prize; Honorable Mention: Best Use of Agentic Commerce, Best Use of PayPal + AI, Best Demo Delivery; Sponsor: Best Use of Channel3.

### About the project (Markdown)

```markdown
## Inspiration
Every "AI shopping assistant" I tried ends the same way: a list of links and "happy shopping". The hard part isn't finding a keyboard, it's the last step: deciding and paying, and doing it again next month without me babysitting it. PayPal's prompt for this hackathon said it plainly: *not just recommend, but actually transact*. Gofer is my answer to that sentence.

## What it does
Gofer is an iPhone agent that buys things for you with PayPal.

- **Say what you need.** "Wired mechanical keyboard, blue switches, under $120."
- **It finds it.** Real inventory across retailers via Channel3. Every result is checked against your hard constraints using structured attributes (switch type, connectivity, size…), not just the title. You get three candidates, each with a one-line trade-off.
- **You approve, it pays.** Tap *Buy with PayPal*; the PayPal sheet opens inside the app. Gofer creates and captures the order (PayPal Orders v2) and, with your consent, vaults your wallet.
- **Then it buys on its own, within rules you set.** *Buy without asking under $100, monthly cap $500.* Inside those limits Gofer charges your saved PayPal wallet with no sheet. Outside them, PayPal asks you.
- **Watch a price.** "Buy it automatically if it drops under $60." A cron re-checks the live price; when it hits, Gofer buys unattended, still inside your rules. If the rules say no, the watch is parked for a one-tap approval.
- **Every order shows how it was authorised**: approved in PayPal, bought automatically, or bought on price drop, plus shipment tracking.

## How we built it
- **iOS**: SwiftUI, iOS 17+, XcodeGen. Chat with streaming agent events, product cards, receipts, Orders and Rules tabs. PayPal approval runs in `ASWebAuthenticationSession` and returns through a custom URL scheme.
- **Backend**: Cloudflare Worker (TypeScript) with D1. The agent is a tool loop on **Cloudflare Workers AI** (Llama 3.3 70B, function calling) with tools `search_products`, `present_candidates`, `start_checkout`, `watch_price`. Events stream to the phone over SSE.
- **PayPal**: OAuth2, Orders v2 create/capture/get/track, Vault (`store_in_vault: ON_SUCCESS` on the first approved order, `payment_source.paypal.vault_id` for unattended charges).
- **Channel3**: `/v1/search` with price and availability filters, `/v1/products/{id}` for re-pricing watches, price-tracking subscription.
- **Rules engine**: `commerce.decide()` on the server decides *approve vs. auto* for every purchase. The model never gets to skip it.

## Challenges we ran into
- **An agent that spends money must not be prompt-dependent.** Early on, a single-candidate result made the model skip "which one?" and buy. Now the loop refuses `start_checkout` unless the user's latest message selects a product, and never in the same turn in which candidates were presented. Prompts advise; code decides.
- **Unattended payments.** Getting PayPal Vault right in the sandbox (vault on first approval, then `vault_id` charges that auto-capture) was the key technical risk; it was the first thing I verified with curl before writing UI.
- **Small models follow rules loosely.** Llama sometimes presented a product its own reason admitted was wrong ("…but no blue switches"). A server-side filter drops any pick whose reason negates a constraint.
- **Shipment tracking**: the classic `/v1/shipping/trackers-batch` endpoint returns 403 for a default sandbox app; Orders v2 `/track` works.

## Accomplishments that we're proud of
A real end-to-end loop on a phone: natural-language request → verified candidates → PayPal approval → vaulted wallet → rule-bound unattended purchases → price-triggered purchases, all persisted, all auditable in the Orders tab. And a backend that keeps the human in charge even when the model gets it wrong.

## What we learned
Agentic commerce is 20% model and 80% guardrails, consent and receipts. The product that earns trust is the one that can explain, for every dollar, who authorised it and under which rule.

## What's next for Gofer
Push notifications for unattended buys, PayPal webhooks for order state, multi-quantity and variants (size/colour), shared household rules, and a PayPal Agent Toolkit / MCP surface so other agents can hand Gofer a shopping task.
```

### Product feedback (if the form asks)
- **Which tools:** PayPal Orders v2, Vault, Orders tracking; Channel3 search/detail/price tracking; Cloudflare Workers AI.
- **What worked:** sandbox OAuth + Orders v2 were running in under an hour; vault-on-approval then `vault_id` charges behave exactly as documented; Channel3's structured attributes make constraint checking possible without scraping.
- **What needs work:** `/v1/shipping/trackers-batch` 403 for default sandbox apps with no hint that Orders v2 `/track` is the alternative; Channel3 occasionally returns intermittent 500s that succeed on retry; the Workers AI function-calling schema rejects `content: null` on assistant messages (OpenAI convention) with an opaque error.
- **Onboarding:** PayPal: developer dashboard auto-creates a sandbox app and business/personal accounts, zero-to-first-capture was smooth. Channel3: key + one curl.
- **Would build again:** Yes. Orders v2 + Vault is all an agent needs to move money safely, and the sandbox is faithful.

### Testing notes for judges (paste into the submission's testing field, not the repo)
- TestFlight link: `<link>`; or build from source (README).
- PayPal **sandbox personal** account for checkout: `<email>` / `<password>` (sandbox only).
- Suggested path: README → "Testing guide for judges" (4 steps). Simulate price drop is Debug-only; in the TestFlight build the cron evaluates live prices every 15 minutes.

---

## 3. Pre-submission checklist
- [ ] Video uploaded to YouTube (public or unlisted), ≤ 3:00, link in form
- [ ] GitHub repo public, LICENSE visible in About
- [ ] README placeholders filled (video, TestFlight)
- [ ] TestFlight public link live; or clear "build from source" instructions confirmed on a clean machine
- [ ] Worker deployed, `/health` ok, cron enabled
- [ ] Sandbox personal account credentials in testing notes
- [ ] Prize categories ticked: Agentic Commerce, PayPal + AI, Demo Delivery, Channel3
- [ ] Submit by **Nov 10**; re-read form for mandatory fields
