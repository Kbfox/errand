# Gofer — 产品化落地方案（从黑客松演示到真实可用）

> 2026-10-13 起草。前置文件：`plan.md`（黑客松产品定义与排期）、`appstore.md`（1.0 上架文案）。
> 本文件回答一个问题：要让 Gofer 真正实现它的产品目的，App 还要做什么、按什么顺序做、每一步怎么验收。

---

## 1. 产品目的，拆成三个承诺

Gofer 的目的：**用户只说一句需求，这次购买由 Gofer 办完。** "办完"拆成三个用户能感知的承诺，后面每一项开发都要对得上其中一个。

| 承诺 | 用户感受 | 1.0 演示版现状 |
|---|---|---|
| 找得对 | 三个候选都满足我的硬条件，每个都说清取舍 | **已真实**：Channel3 真实库存，结构化属性过滤（`constraints.ts`） |
| 等得起 | 我说"跌到 $60 再买"，它替我盯着，在对的时刻出手 | **已真实**：cron 每 15 分钟查 Channel3 现价 |
| 付得掉、送得到 | 我点头（或规则允许）后，钱付给真正的卖家，东西寄到我家 | **假的**：钱进了 Gofer 自己的 PayPal 沙盒商户账号；没有任何零售商订单；不收集收货地址（`shipping_preference: NO_SHIPPING`）；物流号靠手动写入 |

第三个承诺正是 Gofer 区别于导购聊天机器人的地方（README："It does not recommend and stop. It transacts."），也是唯一还没落地的一个。**所以落地主线只有一条：接上真实履约。** 真钱、账号、安全、上架都围绕它排。

## 2. 北极星与验收指标

- **北极星：每周办完的委托数**，即用户提出需求后以真实订单收尾的次数。v1.1 按"经 Gofer 跳转、被零售商归因成交"计；v2 按"Gofer 下单且商户确认发货"计。
- **护栏（任何阶段都不能破）**：未经授权的扣款为 0；规则外的购买 100% 回到用户手里批准。
- **过程指标**
  - 找得对：首轮候选采纳率（3 选 1 被点击的会话占比）；固定评测集上的约束违反率
  - 等得起：盯价命中率；命中后成交率
  - 付得掉：下单成功率、到货率、退款与争议率
  - 体验：首个候选出现时间 P50（现在 DeepSeek 一轮约 13 秒）

## 3. 关键决策：履约通道

| 通道 | 怎么付 | 卖家（MoR） | 覆盖 | 对 Gofer 的要求 | 现状 |
|---|---|---|---|---|---|
| **A 零售商跳转** | 用户在零售商页面自己付 | 零售商 | Channel3 全部商品（官方称 1 亿+） | 几乎没有；带 key 的 Channel3 buy link 自动归因佣金（平台抽 50%，退货期过后经 Stripe 打款） | 现在就能做 |
| **B 商户直连 agent 结账** | Agent 下单，PayPal 直接付给商户 | 商户 | 只有接入 PayPal Agent Ready / Store Sync（或 Google UCP 等协议）的商户 | 向 PayPal AI 团队提交准入表单，非自助开通 | 要申请 |
| **C 通用代下单（Rye 类）** | 浏览器自动化在任意商户结账；买家支付走 Stripe token 等，文档未提 PayPal | 随支付方式而定，可能落到 Gofer | 仅美国、实物、单商品 | 可能要当代购商户：销售税、退货、拒付、垫资；被代下单网站的服务条款风险 | 有 staging |

**建议**

1. **不自己做代购商户**（"Gofer 先收用户的钱，再拿公司卡去零售商买"）。一个人扛不住销售税、退货、拒付和 PayPal 对代购模式的风控审查；而且用户要的是"有人替我办"，不是多一个中间商。
2. **v1.1 用 A 打底**。它让"找得对、等得起"立刻对真实用户成立，第三个承诺暂时降级为"一键到零售商结账页"。A 以后也是所有未接入商户的兜底通道。
3. **v2 以 B 为目标**。它是唯一同时满足"Agent 真付款、用 PayPal、商户仍是卖家"的通道，和黑客松叙事一致，规则引擎可以原样复用。准入表单现在就交。
4. **C 只作补充评估**：P0 用 staging 跑通一单，B 覆盖不足时再考虑，不进主线。

**B 的头号待确认问题**：现在的 Vault 是 Gofer 作为商户存下的（`usage_type: MERCHANT`），这个 `vault_id` 能否在 B 下用于向别的商户付款（例如以平台身份 `PLATFORM` + `payee` 代收），决定了"规则内无人值守购买"在 v2 还能不能成立。准入沟通时第一个问这个。

## 4. 分阶段计划

### P0 评审保护期（现在 → 11-12 截止，延续到结果公布）

约束（同 CLAUDE.md）：线上 Worker `gofer`、远程 D1 `errand`、PayPal 沙盒 App、TestFlight Judges 组都不动。

- **新环境**：wrangler `[env.next]` 部署 `gofer-next` + 独立 D1；iOS 加 Staging 配置指向它。新构建只发 TestFlight Internal 组，**不加进 Judges 组**。
- **你本人做**
  1. 提交 PayPal agentic commerce 准入表单（developer.paypal.com → Agentic commerce services）
  2. Channel3 换成能归因佣金的 key，确认佣金经 Stripe 打款时，你的收款主体所在地是否支持
  3. 决定经营主体（个人还是公司、在哪个国家）。它决定 PayPal live 商户账号、佣金收款、隐私政策署名
  4. 1.0 审核若因 2.2（演示版）被拒，不申诉，直接改提 v1.1
- **可以先写（只在分支和 `gofer-next` 上）**：第 5 节的安全修复；履约通道抽象；50 条需求的 agent 评测集
- **验收**：`gofer-next` 可用；准入表单已交；主体已定

### P1 v1.1「真实可用」（约 4 周；开发可立刻开始，提交审核放在 11-12 之后）

目标：去掉沙盒，让前两个承诺对真实用户成立，过 App Store 审核。

1. **鉴权与安全**：第 5 节第 1–3、9 项，是上架真实版本的前提
2. **履约通道抽象 + 通道 A**
   - Worker 新增 `src/fulfillment/`：`link.ts`（A），以后加 `paypal-agentic.ts`（B）；`commerce.buy()` 按商品可用通道分派
   - `orders` 表加 `rail`、`merchant`、`merchant_order_id`，状态改为生命周期：`pending → placed → shipped → delivered / cancelled / refunded`
   - iOS 卡片按钮改为"去 {零售商} 购买"，用 `SFSafariViewController` 打开归因链接；订单页记录"已跳转"并让用户手动标记"已买"
3. **盯价改为"提醒 + 一键去买"**：A 下不能无人值守付款。推送直接深链到该商品的零售商页面
4. **规则页**：暂时隐藏"无需确认自动购买"，保留月预算（用于提醒和超支提示）；服务端规则模型不动，v2 再打开
5. **账号**：匿名可用，可选 Sign in with Apple（换机后盯价和订单不丢）。一旦提供账号，必须有应用内删除账号（审核 5.1.1(v)）
6. **Agent 质量与成本**：评测集进 CI（约束违反率、首候选耗时）；每用户每日轮数上限；Channel3 结果短时缓存；超时与重试
7. **上架**：可售地区收窄到美国（商品与运费都以美国为主）；去掉描述、首页和设置页里的沙盒提示；更新隐私政策（新增账号、跳转与归因数据）；debug 路由改由独立开关控制，不再看 `PAYPAL_ENV`

**验收**：过审上架；Channel3 后台出现归因成交；候选采纳率和首候选耗时有了第一版基线；第 5 节第 1–3、9 项关闭。

### P2 v2「Agent 真付款」（拿到 B 准入后约 6 周）

1. **通道 B 接入**：商户订单号、发货、物流、退货入口进订单生命周期
2. **收货地址与买家资料**：从 PayPal 取地址，或用户地址簿；地址属敏感信息，按最小必要保存
3. **PayPal live**：live 凭证；webhook 验签与事件入库（capture 完成 / 拒绝 / 退款、vault token 删除）；幂等键；退款与争议流程
4. **规则引擎 v2**：商户白名单；单日上限；自动购买前 N 分钟可撤销的冷静期；每笔订单记下当时生效的规则版本，作为同意凭证
5. **盯价恢复无人值守购买**：先完成第 5 节第 4–6 项
6. **验收**：真实订单闭环（下单、扣款、发货、到货）；未授权扣款为 0；退款路径演练通过

### P3 留存与扩展（v2 之后，按数据挑）

- **周期补货**（"猫砂每月一袋，单价不超过 $25"）：规则加盯价的自然延伸，最贴近"替我办"
- App Intents / Siri / 小组件（盯价状态）
- 家庭共享规则
- 对外 MCP 接口：让别的 agent 把购物委托交给 Gofer
- 收入：佣金之外可考虑订阅（更多盯价、自动购买）。订阅属数字服务，要走 IAP，可复用 MustPlay 的 RevenueCat 经验

## 5. 上真钱前必须修的代码问题（已在代码中确认）

| # | 位置 | 问题 | 修法 |
|---|---|---|---|
| 1 | `worker/src/index.ts` `userOf()` | 用户身份取自客户端自报的 `x-user-id`；`APP_KEY` 打包在 Info.plist 里，可被提取。user id 是随机 UUID，难猜，但一旦泄露（日志、截图、客服往来），别人就能以该用户身份、用他保存的钱包按他的规则下单 | 注册或登录时服务端签发会话令牌（HMAC 签名，绑定 user id）；App Attest 限定只有正版 App 能调用 |
| 2 | `index.ts` `/watches/:id/cancel`、`/watches/:id/approve` | 不校验这条 watch 是否属于当前用户 | 所有按 id 访问的资源都加 `user_id = ?` |
| 3 | `index.ts` `/paypal/orders`、`/paypal/orders/:id/capture`、`/paypal/tracking`、`/channel3/search` | 第 1 周调试用的直通接口，App 用不到 | 生产环境移除，或只在 debug 开关下可用 |
| 4 | `worker/src/paypal.ts` `createOrder` / `captureOrder` | `PayPal-Request-Id` 每次随机，网络重试会建出第二笔订单、扣两次款 | 用购买意图 id（checkout id、watch id）派生幂等键 |
| 5 | `worker/src/watch.ts` `evaluate` | 先扣款后改状态。cron 和手动触发重叠，或扣款成功但写库失败，都会再买一次 | 先 `UPDATE watches SET status='buying' WHERE id=? AND status='active'` 抢占，抢到才下单 |
| 6 | `worker/src/db.ts` `monthSpent` + `commerce.decide` | 先查后买，并发两笔自动购买可同时通过月上限；只计 `COMPLETED`/`SHIPPED` | 下单前写 pending 记录并计入额度 |
| 7 | `index.ts` `/paypal/webhook` | 未验签，只打日志 | 调 `/v1/notifications/verify-webhook-signature` 验签，按事件更新订单 |
| 8 | `paypal.ts` `shipping_preference: "NO_SHIPPING"` | 不收集地址，真实履约没法发货 | 通道 B 下从 PayPal 取地址，或用用户地址簿 |
| 9 | `index.ts` `/agent` | 不限流，LLM 费用全由开发者的 DeepSeek 余额承担 | 每用户每日轮数上限 + 全局预算告警 |

## 6. 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| PayPal 准入慢或不给 | v2 推迟 | v1.1 本身成立（找、盯、跳转）；同时评估通道 C |
| B 下 Vault 不能跨商户用 | 无人值守购买受限 | 准入沟通先问；不行就 v2 先做"规则内一键批准"（推送里直接拉起 PayPal） |
| 自动购买出事故（买错、买重） | 信任崩塌 | 冷静期、幂等、抢占、每笔可撤销、每笔推送 |
| 佣金打款不支持你的主体所在地 | v1.1 没有收入 | P0 先确认；不行就 v1.1 先不追收入，只验证留存 |
| 审核追问"替用户自动付款" | 上架延误 | 审核备注写清同意流程，附规则页截图；自动购买默认关闭 |
| 改动线上影响评审 | 黑客松损失 | 一律在 `gofer-next` 开发，P0 约束不解除 |

## 7. 需要你决定或亲自做的

1. 履约路线是否按"A 打底、B 为目标、不做代购商户"走
2. 经营主体
3. 提交 PayPal agentic commerce 准入表单（需要你登录）
4. Channel3 佣金 key 与收款方式
5. 1.0 若被拒，是否直接改提 v1.1

## 参考

- PayPal Agentic commerce services 概览（准入需填表）：https://developer.paypal.com/agentic-commerce-services/about
- Channel3 佣金说明：https://docs.trychannel3.com/commissions
- Channel3 UCP 端点（仅目录，不含结账）：https://docs.trychannel3.com/ucp/quickstart
- Rye Universal Checkout 文档（支付、限制、staging）：https://docs.commerce.jolly.dev/llm-context.md
- PayPal 对 AP2 的支持：https://developer.paypal.com/community/blog/PayPal-Agent-Payments-Protocol/
