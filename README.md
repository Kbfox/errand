# Errand

> Tell it what you need. It finds it, you approve, it pays.

An iOS shopping agent built for the **PayPal AI Hackathon 2026**. You describe what you want in plain language; the agent searches real products across retailers (Channel3), explains the trade-offs, and checks out with PayPal (sandbox). Spending rules let it buy on your behalf within limits you set.

## Layout

```
worker/   Cloudflare Worker (TypeScript): agent loop, PayPal + Channel3 tools, webhooks, cron
ios/      SwiftUI app (iOS 17+), XcodeGen project
docs/     plan, submission notes
```

## Run the backend locally

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # fill in sandbox credentials
npm run dev                      # http://localhost:8787
```

Smoke-test the PayPal sandbox round trip (create order → approve in browser → capture):

```bash
cd worker && ./scripts/smoke-paypal.sh
```

## Run the iOS app

```bash
cd ios
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig   # set API_BASE_URL
xcodegen generate
open Errand.xcodeproj
```

## Status

Week 1 scaffold. See `docs/plan.md`.
