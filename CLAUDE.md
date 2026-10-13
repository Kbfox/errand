# Gofer — 交接

## 当前状态（2026-10-13 02:00，上一会话结束时）
本会话做完的事（全部在线上环境验证）：
- **App 整体走通一遍**（iPhone 18 Pro，Debug 签名构建、`API_BASE_URL` 覆盖为线上 Worker）：键盘搜索 3 卡 → PayPal 沙盒审批（登录态仍有效，无需密码）→ 绿色收据且钱包已存 → Rules $100/$500 → 跑鞋 $39.95 "Bought for you with PayPal" → 盯价 watch → curl simulate → 推送横幅（日志 UIWillPresentNotificationAction）→ Orders 页三种授权。**录前数据已重置**（该用户 orders/watches 清空、规则归零、vault_id 置 NULL），App 已重启，状态栏已 9:41。
- 修了两个会影响演示的坑：① `xcodegen generate` 会把 `Gofer.entitlements` 清空（project.yml 没写 properties），推送注册静默失效——已在 project.yml 的 `entitlements.properties` 写 `aps-environment`；② 多轮对话里候选过滤用的是**第一条**用户消息（"blue switches"），第二个请求（跑鞋）全被当颜色冲突剔成 "Top 0"——`agent.ts` 改为用最新一条非 "(id …)" 的用户消息，已部署。
- **TestFlight**：App Store Connect 记录已建，名称 **Gofer Shopping Agent**（"Gofer" 被占用），ASC App ID **6822217457**，SKU gofer-ios，主语言 en-US。Build **1.0 (1)** 已上传并处理完（归档用 `CODE_SIGNING_ALLOWED=NO`，导出 `-allowProvisioningUpdates` 自动签名；Info.plist 需 `UISupportedInterfaceOrientations` + `UIRequiresFullScreen`，已加进 project.yml）。内部群组 **Tester**（自动分发，尚未加测试员）和外部群组 **Judges** 已建。
- 代码已提交（9eb021b），本次会话结束前会 push。

**剩余（需用户参与）**：
1. 用户在模拟器过一遍 App（已是干净状态，可直接按 `docs/submission.md` 第 1 节脚本走）。盯价那句要点出**当前卡片上的完整标题**，否则 Llama 可能挑错商品（本次把 "Lofree typewriter keyboard" 理解成已买的 Wired 款）。
2. 录视频：构建命令见下方"命令"，加 `API_BASE_URL=https://gofer.kbfoxtk.workers.dev`。推送横幅只显示几秒，录屏要连着拍。simulate 用 `curl -X POST .../debug/watches/<id>/simulate -H "x-app-key: …" -H "x-user-id: 88A7DF07-…" -d '{"price":58}'`（App 内 Debug 按钮同效）。
3. TestFlight 公开链接：在 ASC → TestFlight → 外部测试 "Judges" → 添加构建版本 1 → 填测试信息（Beta 描述、反馈邮箱、联系人、**电话**）→ 提交 Beta App Review（助手的权限策略不允许代点提交；审核通常 1 天内）→ 群组"设置"里开启公开链接 → 链接填进 README 与 submission.md。内部群组 Tester 可把用户自己加为测试员装到真机。
4. Devpost：内置浏览器 tab 已停在 Cloudflare 人机验证，用户点一下后助手继续 Join / 建草稿 / 填文案（`docs/submission.md` 第 2 节）。截止 **11-12 12:00 PT**，目标 11-10。
5. 可选：给 Charlie（RevenueCat）回 MustPlay 上架短信（草稿在 MustPlay 对话里）。

用户的模拟器 App 用户 id：`88A7DF07-8698-4991-92D2-51CBD94C102C`（UserDefaults 键 `gofer.userId`，用 plistlib 读 `Library/Preferences/com.gofer.ios.plist`）。该 id 在**远程 D1** 有 users/rules/devices 行（两台设备 token）；**本地 D1** 的钱包种在旧 id 下，联调本地时重新 `UPDATE users SET vault_id='85t12131c62061906' ...`。

**会话习惯**：另一个会话可能在 MustPlay 上并行开发，用的是 iPhone 18 Pro Max 模拟器和 8788 端口；**不要 `pkill -f "wrangler dev"`**，只按 PID 或 `pgrep -f "Gofer/worker"` 杀自己的。本地 Worker 用 8787。**模拟器工具每次调用都要显式传 device=250FDF0D-…**，不传会落到 18 Pro Max 上（本次误点了一次 MustPlay）。


PayPal AI Hackathon 2026 参赛项目。产品定义与排期见 `docs/plan.md`。截止 **2026-11-12 12:00 PT（北京 11-13 04:00）**，目标 11-10 提交。

## 结构
- `worker/` Cloudflare Worker（TypeScript）。`src/paypal.ts` 已封装 OAuth / create order / capture / get / tracking / Vault 参数；`src/channel3.ts` 搜索（端点形状待对照 docs.trychannel3.com 确认）；`src/index.ts` 路由，`/agent` 尚未实现（第 2 周：Claude 工具循环 + SSE）
- `ios/` XcodeGen 工程。`CheckoutCoordinator` 用 `ASWebAuthenticationSession` 打开 PayPal 审批页，Worker 的 `/paypal/return` 捕获后跳回 `gofer://paypal/return`。第 1 周 `ChatView` 只有一个付款按钮用来验证链路
- 密钥：`worker/.dev.vars`（本地）/ `npm run secrets`（线上）；`ios/Config/Secrets.xcconfig`。均已 gitignore，不要把值贴进对话

## 命令
```
cd worker && npm install && npm run dev            # 本地 8787
cd worker && ./scripts/smoke-paypal.sh             # curl 级沙盒下单→审批→capture
cd ios && xcodegen generate && xcodebuild -project Gofer.xcodeproj -scheme Gofer -destination 'platform=iOS Simulator,id=250FDF0D-DF15-4DC0-B569-B17ACF39C22A' -derivedDataPath build/dd -allowProvisioningUpdates API_BASE_URL=https://gofer.kbfoxtk.workers.dev build   # 带签名，推送才能注册；录视频/演示直连线上要加 API_BASE_URL 覆盖；装机 xcrun simctl install 250FDF0D-DF15-4DC0-B569-B17ACF39C22A build/dd/Build/Products/Debug-iphonesimulator/Gofer.app
```
新增 Swift 文件后必须 `xcodegen generate`（它会重写 Info.plist 和 entitlements，所有键必须写在 project.yml 里）。TestFlight 上传：`xcodebuild ... -configuration Release -destination 'generic/platform=iOS' -archivePath build/Gofer.xcarchive CODE_SIGNING_ALLOWED=NO archive` 然后 `xcodebuild -exportArchive -archivePath build/Gofer.xcarchive -exportOptionsPlist Config/ExportOptions.plist -exportPath build/export -allowProvisioningUpdates`（destination=upload）。模拟器用 **iPhone 18 Pro `250FDF0D-DF15-4DC0-B569-B17ACF39C22A`**（18 Pro Max 归另一会话的 MustPlay 用）。

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
