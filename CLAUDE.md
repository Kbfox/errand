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

## 第 1 周验证结果（2026-10-13，沙盒，美区账号）
- OAuth → create order（带 `attributes.vault.store_in_vault=ON_SUCCESS`）→ 用户审批 → capture：**COMPLETED**，返回 `payment_source.paypal.attributes.vault.id`（VAULTED）
- 用 `payment_source.paypal.vault_id` 建单：**直接 COMPLETED 并自动 capture，无需审批** → "盯价代买"无人值守付款可行
- 物流：`POST /v2/checkout/orders/{id}/track` 201 可用；`/v1/shipping/trackers-batch` 403，不要用
- Channel3 自带 Price Tracking 接口（start/stop/history），盯价不用自己轮询
- 沙盒 vault_id / customer id 记在对话里，不入库；真实实现要按用户持久化到 D1

## 约定
- 提交者 `-c user.name="Kbfox" -c user.email="52fdcbrgmr@privaterelay.appleid.com"`，trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- 远程 github.com/Kbfox/errand（公开，MIT，规则要求）
