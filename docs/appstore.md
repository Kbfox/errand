# Gofer — App Store listing (version 1.0)

ASC app: **Gofer Shopping Agent** (Apple ID 6822217457, bundle `com.gofer.ios`, SKU `gofer-ios`, primary language en-US).
Build for review: **1.0 (2)** (adds the in-app sandbox notice and privacy/support links).

## URLs
- Privacy policy: https://kbfox.github.io/mustplay-site/gofer/privacy.html
- Support: https://kbfox.github.io/mustplay-site/gofer/support.html
- Marketing: https://kbfox.github.io/mustplay-site/gofer/
(Hosted in the `Kbfox/mustplay-site` Pages repo under `gofer/` because the CLI token cannot enable Pages on `Kbfox/gofer`. Source copies live in this repo's `docs/`.)

## App information
- Subtitle (≤30): `Finds it, you approve, it pays`
- Primary category: Shopping · Secondary: Productivity
- Age rating: 4+ (all questionnaire answers "None"/"No")
- Content rights: shows third-party retailer product images and prices returned by the Channel3 API (user to confirm the declaration)
- Price: Free · Availability: all territories except China mainland (no ICP filing)
- Release: manual (developer releases after approval)

## Promotional text (≤170)
Demo of an AI shopping agent that pays with PayPal. Runs in the PayPal sandbox: no real money moves. Built for the PayPal AI Hackathon 2026.

## Description
Gofer is an AI shopping agent that finds what you need and pays with PayPal.

IMPORTANT: this version is a demo built for the PayPal AI Hackathon 2026. It is connected to the PayPal sandbox. No real money is charged and no order is placed with a retailer. To complete a checkout you need a free PayPal sandbox account from developer.paypal.com.

SAY WHAT YOU NEED
"Wired mechanical keyboard, blue switches, under $120." Gofer searches real products across retailers and checks each result against your must-haves using structured attributes, not just titles. You get three picks, each with a one-line trade-off. You can also start from a photo.

YOU APPROVE, IT PAYS
Tap Buy with PayPal and approve in PayPal, right inside the app. With your consent, PayPal saves your wallet for next time.

SET THE RULES ONCE
"Buy without asking under $100, monthly cap $500." Inside your limits Gofer charges your saved PayPal wallet without opening PayPal. Anything else goes back to you for approval. The rules are enforced on the server, so the AI cannot talk its way around them.

WATCH A PRICE
"Buy it automatically if it drops under $60." Gofer re-checks the price every 15 minutes and buys the moment it hits, still within your rules, then sends you a notification.

EVERY ORDER HAS A RECEIPT
The Orders tab shows how each purchase was authorised: approved in PayPal, bought automatically, or bought on a price drop.

No account, no ads, no tracking. Source code: github.com/Kbfox/gofer

## Keywords (≤100)
shopping,agent,ai,paypal,assistant,buy,price,watch,deal,budget,rules,auto,checkout,tracker

## Copyright
2026 Kbfox

## App Review notes (≤4000)
Gofer is a demo built for the PayPal AI Hackathon 2026 (https://paypalaihackathon.devpost.com). It is connected to the PayPal SANDBOX: no real money is charged and no real order is placed with a retailer. The home screen and Settings say so. Physical goods would be paid through PayPal (not In-App Purchase); there is no digital content to sell.

No sign-in is required to use the app. To complete a checkout, PayPal's sandbox sign-in page opens inside the app; please use this PayPal sandbox personal account:
  Email: <sandbox email>
  Password: <sandbox password>

How to test (about 3 minutes):
1. Gofer tab: tap "Wired mechanical keyboard, blue switches, under $120". The agent searches for 10–20 seconds and shows three cards.
2. Tap "Buy with PayPal" on any card, tap Continue on the system prompt, sign in with the sandbox account above and tap "Agree & Pay Now". You return to the app with a green "Paid with PayPal" receipt; PayPal has saved the sandbox wallet.
3. Rules tab: set "Buy without asking under" to $100 and Monthly cap to $500, tap Save.
4. Gofer tab: type "Running shoes for wide feet, size 10, under $90", then tap Buy on a card under $100. It completes without opening PayPal: "Bought for you with PayPal".
5. Type "Don't buy the <title of a card> now. Buy it automatically if it drops under $60." A "Watching the price" card appears and the Orders tab lists the watch. A server job re-checks prices every 15 minutes.
6. Orders tab shows every order and how it was authorised.

Data: the app creates a random device ID (no account). Requests are processed by our Cloudflare Worker, DeepSeek (language model) and Channel3 (product search). Privacy policy: https://kbfox.github.io/mustplay-site/gofer/privacy.html. Source code: https://github.com/Kbfox/gofer

## Screenshots (6.3-inch slot "iPhone with Dynamic Island, medium", 1206×2622, JPEG)
`~/Desktop/gofer-appstore-screenshots/01–07.jpg`: home, three keyboard picks, PayPal sandbox approval, bought automatically, rules, watching a price, orders. Upload in that order (the built-in browser cannot pick files, so the user uploads them).
