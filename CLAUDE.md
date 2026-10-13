# Gofer — 交接

PayPal AI Hackathon 2026 参赛项目。产品定义与排期见 `docs/plan.md`。截止 **2026-11-12 12:00 PT（北京 11-13 04:00）**，目标 11-10 提交。

## 结构
- `worker/` Cloudflare Worker（TypeScript）。`src/paypal.ts` 已封装 OAuth / create order / capture / get / tracking / Vault 参数；`src/channel3.ts` 搜索（端点形状待对照 docs.trychannel3.com 确认）；`src/index.ts` 路由，`/agent` 尚未实现（第 2 周：Claude 工具循环 + SSE）
- `ios/` XcodeGen 工程。`CheckoutCoordinator` 用 `ASWebAuthenticationSession` 打开 PayPal 审批页，Worker 的 `/paypal/return` 捕获后跳回 `gofer://paypal/return`。第 1 周 `ChatView` 只有一个付款按钮用来验证链路
- 密钥：`worker/.dev.vars`（本地）/ `npm run secrets`（线上）；`ios/Config/Secrets.xcconfig`。均已 gitignore，不要把值贴进对话

## 命令
```
cd worker && npm install && npm run dev            # 本地 8787
cd worker && ./scripts/smoke-paypal.sh             # curl 级沙盒下单→审批→capture
cd ios && xcodegen generate && xcodebuild -project Gofer.xcodeproj -scheme Gofer -destination 'platform=iOS Simulator,id=FA278CFD-405E-4646-888C-1F36769773E8' -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
```
新增 Swift 文件后必须 `xcodegen generate`。模拟器 iPhone 18 Pro Max `FA278CFD-405E-4646-888C-1F36769773E8`。

## 账号（用户已建）
- PayPal 开发者后台已有沙盒 App "Default Application"；沙盒账号：自动生成的 C2（中国）一对 + 用户手建的美区 Business/Personal 一对。**演示一律用美区账号**
- Channel3、Qloo key：见对话进度

## LLM 方案（2026-10-13 定稿）
用户没有 Anthropic key，agent 改用 **Cloudflare Workers AI**（`[ai] binding = "AI"`，模型 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`，无需 key，走 Cloudflare 免费额度）。`src/llm.ts` 是 provider 无关层，`LLM_PROVIDER=openai-compatible` + `LLM_BASE_URL` + secret `LLM_API_KEY` 可切 DeepSeek / OpenAI / Qwen。坑：Workers AI 的 assistant 消息 content 不能为 null，要给 ""；SSE 后台任务必须 `ctx.waitUntil`，否则返回响应后被回收，流只剩第一个事件。
`src/agent.ts`：工具 search_products / present_candidates / start_checkout，最多 6 步，事件 status / candidates / message / checkout / error / done。多轮：客户端把上一轮的 candidates 原样回传。本地 `wrangler dev` 下 AI binding 走远程，需要 wrangler 已登录。

## 第 1 周验证结果（2026-10-13，沙盒，美区账号）
- OAuth → create order（带 `attributes.vault.store_in_vault=ON_SUCCESS`）→ 用户审批 → capture：**COMPLETED**，返回 `payment_source.paypal.attributes.vault.id`（VAULTED）
- 用 `payment_source.paypal.vault_id` 建单：**直接 COMPLETED 并自动 capture，无需审批** → "盯价代买"无人值守付款可行
- 物流：`POST /v2/checkout/orders/{id}/track` 201 可用；`/v1/shipping/trackers-batch` 403，不要用
- Channel3 自带 Price Tracking 接口（start/stop/history），盯价不用自己轮询
- 沙盒 vault_id / customer id 记在对话里，不入库；真实实现要按用户持久化到 D1

## 推送（2026-10-13 凌晨验证通过）
- Worker `src/apns.ts`：用团队 APNs key（Key ID 96B53G7L5Y，同 MustPlay）签 ES256 JWT，直接 fetch `api.sandbox.push.apple.com`（Cloudflare 线上走 HTTP/2 正常；**本地 wrangler dev 到 APNs 会 "Network connection lost"，推送只能在线上测**）。secret `APNS_KEY`（.p8 全文），vars APNS_KEY_ID / APNS_TEAM_ID / APNS_TOPIC / APNS_ENV 在 wrangler.toml。盯价成交 / 需审批时 `watch.ts` 调 `apns.notifyUser`。`POST /devices` 存 token（表 devices）。`POST /debug/push` 返回每台设备的 APNs 状态码。
- iOS：`AppDelegate` 注册远程通知并上报 token；`PushPermission.requestIfNeeded()` 在首单成功 / 建 watch 后弹权限；Settings 有 Enable 和 Debug 的 Send test push。**模拟器构建必须带签名**（`xcodebuild ... -allowProvisioningUpdates`，不要 CODE_SIGNING_ALLOWED=NO），否则 aps-environment 不嵌入、注册被忽略。
- App ID `com.gofer.ios` 已通过一次 `archive + exportArchive -allowProvisioningUpdates`（`ios/Config/ExportOptions.plist`，method app-store-connect / destination export）在开发者账号注册并带推送能力；之前 APNs 返回 TopicDisallowed 就是因为没注册。
- 改名后 UserDefaults 键变为 `gofer.userId`，模拟器上的用户 id 换了（旧数据在 errand.userId 下，不用管）。

## 线上环境（2026-10-13 部署）
- Worker：**https://gofer.kbfoxtk.workers.dev**（`cd worker && npm run deploy`）。远程 D1 已迁移（`wrangler d1 migrations apply errand --remote`），4 个 secret 已设（PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / CHANNEL3_API_KEY / APP_KEY，值取自 .dev.vars）。`PUBLIC_BASE_URL` 在 wrangler.toml 指向线上，本地由 .dev.vars 覆盖为 localhost。
- iOS：`API_BASE_URL` 按配置区分，Debug=localhost:8787，Release=线上（project.yml settings.configs）。TestFlight 用 Release。
- 线上验证：/health ok、Channel3 搜索 ok、/agent 一轮（Workers AI）ok。

## 进度
- **10-13 晚：第 2 周目标提前达成**。模拟器里从示例需求 → 3 张候选卡 → 点 Buy → agent 建单 → App 内 PayPal 登录付款 → 跳回 → 绿色收据卡，订单 4SS16439R7402661J COMPLETED $79.97，且 Vault 已存。
- **10-13 深夜：第 3 周主体完成**。D1（users/rules/orders/watches）、规则引擎 `commerce.decide`、规则内用 vault_id 无人值守付款、盯价 `watch.evaluate`（cron 每 15 分钟 + `/debug/watches/:id/simulate` 强制价格走同一条代码路径）、iOS 三个 Tab（Gofer / Orders / Rules）。模拟器实测：Rules 页设 $100/$500 → 聊天里 $76.90 的键盘直接 "Bought for you with PayPal"，订单 93G362961A2581028。
- **安全闸（务必保留）**：`agent.ts` 里 start_checkout / watch_price 有服务端硬条件：同一轮刚 present_candidates 不允许下单；用户最新消息必须含商品 id 或购买动词。起因：只有一个候选时 Llama 跳过提问直接下单并自动扣款了。
- 本地调试种数据：App 的 userId 在模拟器容器 `Library/Preferences/com.gofer.ios.plist` 的 `gofer.userId`（用 plistlib 读，plutil 会把点号当路径）；`wrangler d1 execute errand --local --command "UPDATE users SET vault_id=... WHERE id=..."` 可给用户种已保存钱包。
- **10-13 20:56：第 3 周收口**。iPhone 18 Pro 模拟器（250FDF0D-DF15-4DC0-B569-B17ACF39C22A，Gofer 专用，避开另一会话占用的 18 Pro Max）上：Watching 卡 → Simulate price drop → 订单页出现 "Bought on price drop" $63.00 COMPLETED（订单 70S37519TW733264L）。
- 待做（第 4 周）：推送（可选）；物流写入入口；部署 Worker（`wrangler deploy` + `d1 migrations apply errand --remote` + `npm run secrets`）并把 PUBLIC_BASE_URL / App 的 API_BASE_URL 换成线上；TestFlight；视频；README；Devpost。
- 本地联调：`cd worker && npm run dev` 必须在跑，App 的 `API_BASE_URL` 指向 localhost:8787。

## 约定
- 提交者 `-c user.name="Kbfox" -c user.email="52fdcbrgmr@privaterelay.appleid.com"`，trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- 远程 github.com/Kbfox/gofer（公开，MIT，规则要求）
