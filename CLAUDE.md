# Gofer — 交接

## 当前状态（2026-10-13 晚）：**已提交 Devpost**
Gofer 已于 10-13 在 Devpost 提交（状态 SUBMITTED，项目页 https://devpost.com/software/gofer-ex26ld，编辑入口 https://devpost.com/submit-to/31302-paypal-ai-hackathon/manage/submissions/1235021-gofer/project-overview）。截止 **11-12 12:00 PT** 前仍可编辑。
- 视频 https://youtu.be/6iqcuK7nwzw（源文件与剪辑表见 `docs/submission.md` "Final take"）
- TestFlight https://testflight.apple.com/join/wfkdTAhA（ASC App "Gofer Shopping Agent" 6822217457，构建 1.0 (1) 已过 Beta 审核，约 2027-01-11 过期）
- 线上 Worker https://gofer.kbfoxtk.workers.dev，LLM 为 DeepSeek
- 评委测试说明里的沙盒账号由用户本人填写，不要在对话或仓库里复述

**App Store：✅ 10-13 18:50 已提交审核**（App Review 页状态"等待审核"，构建 **1.0 (3)**，手动发布）。ASC App "Gofer Shopping Agent"（6822217457）：副标题、类别 购物/效率、年龄分级 4+、免费、174 个地区（排除中国大陆，无 ICP）、App 隐私已发布（照片、其他用户内容、搜索历史、设备 ID、购买历史，均仅 App 功能、不关联身份、不追踪）、内容版权（用户本人声明"拥有第三方内容必要权利"）、7 张 6.3 英寸截图（用户上传，源文件 `~/Desktop/gofer-appstore-screenshots/`）、审核备注含沙盒账号（用户本人填写，勿在对话或仓库复述）。隐私 / 支持 / 营销页挂在 `Kbfox/mustplay-site` 的 `gofer/` 下（gh token 无法开 Gofer 仓库 Pages），源文件在本仓库 `docs/`。文案全文 `docs/appstore.md`。坑：xcodegen 的 target 默认 TARGETED_DEVICE_FAMILY=1,2，会让 ASC 要求 13 英寸 iPad 截图，已在 target settings 固定为 "1"；Info.plist 版本号改为引用 build settings。**风险**：可能按 2.2（演示 / 测试版应走 TestFlight）被拒；被拒就保持 TestFlight，不影响黑客松。通过后需要用户在 ASC 手动点"发布此版本"。

**评审期（到结果公布）要保持**：Worker 在线、cron 在跑；DeepSeek 账户有余额（用户的 key，同 MustPlay）；PayPal 沙盒 App 不要删；不要再改 Devpost 以外的线上配置。
**可选**：给 Charlie（RevenueCat）回 MustPlay 上架短信（草稿在 MustPlay 对话里）。

用户的模拟器 App 用户 id：`88A7DF07-8698-4991-92D2-51CBD94C102C`（UserDefaults 键 `gofer.userId`，用 plistlib 读 `Library/Preferences/com.gofer.ios.plist`）。该 id 在**远程 D1** 有 users/rules/devices 行（两台设备 token）；**本地 D1** 的钱包种在旧 id 下，联调本地时重新 `UPDATE users SET vault_id='85t12131c62061906' ...`。

**会话习惯**：另一个会话可能在 MustPlay 上并行开发，用的是 iPhone 18 Pro Max 模拟器和 8788 端口；**不要 `pkill -f "wrangler dev"`**，只按 PID 或 `pgrep -f "Gofer/worker"` 杀自己的。本地 Worker 用 8787。**模拟器工具每次调用都要显式传 device=250FDF0D-…**，不传会落到 18 Pro Max 上（本次误点了一次 MustPlay）。


PayPal AI Hackathon 2026 参赛项目。产品定义与排期见 `docs/plan.md`；赛后产品化（真实履约、上真钱前的安全修复、分阶段计划）见 `docs/roadmap.md`。截止 **2026-11-12 12:00 PT（北京 11-13 04:00）**，目标 11-10 提交。

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

## LLM 方案（10-13 晚改为 DeepSeek，同 MustPlay）
线上 agent 用 **DeepSeek**：`wrangler.toml` 的 `LLM_PROVIDER=openai-compatible`、`LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-chat`，secret `LLM_API_KEY`（用户 10-13 已 `wrangler secret put`）。原因：Workers AI 免费额度每天 1 万 neurons（UTC 0 点重置），用户过一遍 App 就用完（AiError 4006），且 DeepSeek 理由文案明显更好、一轮约 13 秒。回退 Workers AI 只需改回三个 vars（`[ai] binding = "AI"` 仍在）。本地 `.dev.vars` 若要用 DeepSeek 需自己加 `LLM_API_KEY`。`src/llm.ts` 是 provider 无关层。坑：Workers AI 的 assistant 消息 content 不能为 null，要给 ""；SSE 后台任务必须 `ctx.waitUntil`，否则返回响应后被回收，流只剩第一个事件。present_candidates 的工具结果要告诉模型"屏幕上恰好 N 个"，否则它会说"找到三个，只显示两个"。
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
