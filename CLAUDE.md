# Errand — 交接

PayPal AI Hackathon 2026 参赛项目。产品定义与排期见 `docs/plan.md`。截止 **2026-11-12 12:00 PT（北京 11-13 04:00）**，目标 11-10 提交。

## 结构
- `worker/` Cloudflare Worker（TypeScript）。`src/paypal.ts` 已封装 OAuth / create order / capture / get / tracking / Vault 参数；`src/channel3.ts` 搜索（端点形状待对照 docs.trychannel3.com 确认）；`src/index.ts` 路由，`/agent` 尚未实现（第 2 周：Claude 工具循环 + SSE）
- `ios/` XcodeGen 工程。`CheckoutCoordinator` 用 `ASWebAuthenticationSession` 打开 PayPal 审批页，Worker 的 `/paypal/return` 捕获后跳回 `errand://paypal/return`。第 1 周 `ChatView` 只有一个付款按钮用来验证链路
- 密钥：`worker/.dev.vars`（本地）/ `npm run secrets`（线上）；`ios/Config/Secrets.xcconfig`。均已 gitignore，不要把值贴进对话

## 命令
```
cd worker && npm install && npm run dev            # 本地 8787
cd worker && ./scripts/smoke-paypal.sh             # curl 级沙盒下单→审批→capture
cd ios && xcodegen generate && xcodebuild -project Errand.xcodeproj -scheme Errand -destination 'platform=iOS Simulator,id=FA278CFD-405E-4646-888C-1F36769773E8' -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
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

## 进度
- **10-13 晚：第 2 周目标提前达成**。模拟器里从示例需求 → 3 张候选卡 → 点 Buy → agent 建单 → App 内 PayPal 登录付款 → 跳回 → 绿色收据卡，订单 4SS16439R7402661J COMPLETED $79.97，且 Vault 已存。
- 待做（第 3 周）：规则引擎 + RulesView；盯价代买（Channel3 Price Tracking + vault_id 付款 + 推送）；订单持久化 D1 + 历史页；物流写入；提示词后处理（过滤理由里否定硬约束的候选）；部署 Worker 并把 PUBLIC_BASE_URL 换成线上地址；TestFlight。
- 本地联调：`cd worker && npm run dev` 必须在跑，App 的 `API_BASE_URL` 指向 localhost:8787。

## 约定
- 提交者 `-c user.name="Kbfox" -c user.email="52fdcbrgmr@privaterelay.appleid.com"`，trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- 远程 github.com/Kbfox/errand（公开，MIT，规则要求）
