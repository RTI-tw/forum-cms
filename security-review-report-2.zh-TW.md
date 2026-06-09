# Security Re-Review: forum-cms（繁中台灣版）

## Scope 範圍

- Repository：`/Users/hcchien/rti/forum-cms`
- Review base：`f7aab21`（第一次審查基準）
- 修正 commits：`bbf64b9`、`c44de67`、`86e571a`
- Re-review date：`2026-06-01`
- 目標：驗證 26 個原始 findings 是否正確修正，並檢查修正是否引入新問題。
- 2026-06-09 部署邊界校準：`AC-006` 與 `AC-005` 在 GraphQL internal-only／ingress-only 前提下不再列為 active public findings；下方保留程式修正驗證作為 defense-in-depth 紀錄。

---

## 整體結論

原始 26 個 findings **全部已正確修正**。
發現 **3 個新 findings**（1 中、2 低），其中 1 個（NEW-001）為 helmet CSP 設定造成的 reCAPTCHA 功能性退化，建議立即補正。

---

## 原始 Findings 驗證結果

| ID | 嚴重度 | 說明 | 驗證結果 |
|---|---|---|---|
| AUTH-001 | 高 | 硬編碼 session/JWT secret fallback | ✅ 已修正 |
| AC-006 | 高 | createComment 信任用戶端 member | ✅ 已修正；GQL internal-only 時移出 active findings |
| AC-009 | 高 | Report 可隱藏任意文章留言 | ✅ 已修正 |
| AC-010 | 高 | Editor 可自行授予 OfficialMapping 權限 | ✅ 已修正 |
| AC-008 | 高 | PollVote 缺少 poll/option/唯一性驗證 | ✅ 已修正 |
| SC-001 | 高 | Cloud Build curl\|sh 安裝 Syft | ✅ 已修正 |
| AC-001 | 中 | Comment query 洩漏 hidden/rejected 留言 | ✅ 已修正 |
| AC-002 | 中 | Bookmark BOLA | ✅ 已修正 |
| AC-003 | 中 | PollVote BOLA | ✅ 已修正 |
| AC-004 | 中 | Poll/PollOption 草稿洩漏 | ✅ 已修正 |
| AC-005 | 中 | createPost 信任用戶端 author/status | ✅ 已修正；GQL internal-only 時移出 active findings |
| AC-007 | 中 | Bookmark mutation 缺少 owner 隔離 | ✅ 已修正 |
| AUTH-002 | 中 | Reset token 寫入 log | ✅ 已修正 |
| AUTH-003 | 中 | Lockout 可被 name/prefix 觸發 | ✅ 已修正 |
| AUTH-004 | 中 | mustChangePassword 僅靠 client-side redirect | ✅ 已修正 |
| AUTH-005 | 中 | 會員 ban 後 JWT 仍有效 | ✅ 已修正 |
| AUTH-006 | 中 | reCAPTCHA 停用時無 rate limit | ✅ 已修正 |
| CONFIG-001 | 中 | 未設定 security headers | ✅ 已修正（見 NEW-001） |
| DEP-001 | 中 | Production dependencies 含已知漏洞 | ✅ 已修正 |
| FILE-001 | 中 | keywords.json 公開存取 | ✅ 已修正 |
| FILE-002 | 中 | 圖片上傳 2GB buffering | ✅ 已修正 |
| SC-002 | 中 | Dockerfile apt key 未 pin | ✅ 已修正 |
| XSS-001 | 中 | Rich-text embedded-code（package-consumer） | ✅ 確認無 active forum-cms usage |
| AUTH-007 | 低 | 會員註冊洩漏帳號狀態 | ✅ 已修正 |
| XSS-002 | 低 | Rich-text link URL（package-consumer） | ✅ 確認無 active forum-cms usage |
| XSS-003 | 低 | RECAPTCHA_SITE_KEY 字串插值 | ✅ 已修正 |

---

## 修正驗證細節

### AUTH-001 — 硬編碼 secret fallback

**驗證**：`environment-variables.ts` 使用 build-time placeholder 字串（非已知值），`keystone.ts` `extendExpressApp` 加入 `assertRequiredSecrets()` IIFE，secret 未設定或 < 32 字元時拋錯中止。`member-session.ts` 已移除 `DEFAULT_MEMBER_SESSION_SECRET`。

**殘餘注意事項**：`member-session.ts` 的注解寫「已在 environment-variables.ts 驗證」，但實際驗證在 `keystone.ts` extendExpressApp，注解描述有輕微出入，不影響安全性。

### AC-006 — createComment member 覆寫

**歷史驗證**：當時 `resolveInput` 中 `!isCmsRequest(context)` 分支一律呼叫 `getOfficialMemberIdForSessionUser`，強制覆寫 member；session 無效拋錯。2026-06-09 部署邊界校準後，這段非 CMS 強制覆寫已移除，回到「未明確指定 member 時才嘗試自動帶入」邏輯。

**部署邊界校準**：`getOfficialMemberIdForSessionUser` 是 Keystone CMS User -> Official Member mapping，不是前台 member bearer token 驗證。若 production 已強制 GraphQL 只接受 ingress/internal service traffic，原 public API attack path 不成立；若未來重新公開 GraphQL member mutation，需改以 bearer token member identity 綁定。

### AC-008 — PollVote validateInput

**驗證**：`validateInput` 在 `resolveInput` 之後執行（Keystone 6 hook 順序），非 CMS create 時依序：1) poll 存在且文章可見；2) option 屬於 poll；3) 每人每 poll 限一票。`memberId` 若為 null 時唯一性檢查略過，但此情況 `resolveInput` 已拋錯，mutation 不會成功。✅ 邏輯正確。

### AC-009 — Report CMS-only

**驗證**：`validateInput` 最前面檢查 `!isCmsRequest(context)` 並立即回傳驗證錯誤。即使 gql/preview 模式下 operation access 層有風險，此 hook 為額外防護層。✅

### AUTH-003 — Lockout canonical email

**驗證**：新增 `findUserByExactEmail` 只做 `email equals` 精確查詢，lockout counter 更新改用此函式。原有 `findUserByIdentity`（含 name/prefix fallback）仍存在但只用於 log 補充資料取用路徑，不再影響 lockout。✅

### AUTH-004 — mustChangePassword server-side

**驗證**：`app.use("/api/graphql", ...)` middleware 在 `express.json` 解析 body 後執行，能正確讀取 `req.body.query`。`context.withRequest(req, res)` 正確載入 session。

**已知限制**：`allowed.some(op => query.includes(op))` 為 substring 比對，理論上可被含有 `updateUser` 子字串的 GraphQL fragment 名稱繞過。實際可利用性極低（需具 mustChangePassword CMS session 且能構造特定查詢），標記為 **低信心潛在弱點**。

### AUTH-005 — member.status 檢查

**驗證**：`(member as { status?: string }).status !== 'active'` 正確比對 member.ts 定義的三個狀態（`active` / `inactive` / `banned`）。✅

### CONFIG-001 — helmet headers

**驗證**：helmet 正確設定 CSP、HSTS、frameguard、noSniff、referrerPolicy。

⚠️ **發現新問題 NEW-001**（見下方）。

### FILE-001 — keywords.json

**驗證**：`app.get("/files/keywords.json", ...)` 路由在 `extendExpressApp` 中早於 Keystone 靜態路由註冊，回傳 404。✅ Keystone 的 storage static route 是在 extendExpressApp 之後掛載的，優先順序正確。

### XSS-003 — RECAPTCHA_SITE_KEY

**驗證**：兩處 `'${RECAPTCHA_SITE_KEY}'` 均已改為 `${JSON.stringify(RECAPTCHA_SITE_KEY)}`（lines 1054、1636）。✅

---

## 新發現 Findings

### [NEW-001] helmet CSP 阻擋 reCAPTCHA 外部腳本（退化）

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 類別 | OWASP A05 資安設定錯誤（功能性退化） |
| 受影響行號 | `packages/forum-cms/keystone.ts`（extendExpressApp helmet 設定） |

#### 說明

`scriptSrc: ["'self'", "'unsafe-inline'"]` 未包含 `https://www.google.com`，Admin UI 頁面載入 reCAPTCHA API script（`https://www.google.com/recaptcha/api.js`）時會被 CSP 封鎖。此外 `connectSrc: ["'self'"]` 也會阻擋 reCAPTCHA 向 Google 後端的 XHR 請求。

當 `RECAPTCHA_ENABLED=true` 部署時，登入與密碼重設的 reCAPTCHA 驗證功能將完全失效（腳本無法載入），可能導致 AUTH-006 rate limit 成為唯一防護。

#### 修補建議

```typescript
scriptSrc: [
  "'self'",
  "'unsafe-inline'",          // Admin UI 需要，待改 nonce
  "https://www.google.com",   // reCAPTCHA API script
  "https://www.gstatic.com",  // reCAPTCHA widget assets
],
connectSrc: [
  "'self'",
  "https://www.google.com",   // reCAPTCHA verification XHR
  "https://www.gstatic.com",
],
frameSrc: [
  "https://www.google.com",   // reCAPTCHA iframe challenge（v2）
],
```

---

### [NEW-002] AUTH-004 mustChangePassword 攔截可被 GraphQL 查詢命名繞過（低）

| 欄位 | 值 |
|---|---|
| 嚴重度 | 低 |
| 信心程度 | 低 |
| 類別 | OWASP A01 權限控管失效 |
| 受影響行號 | `packages/forum-cms/keystone.ts`（mustChangePassword middleware） |

#### 說明

`allowed.some(op => query.includes(op))` 以 substring 比對判斷是否為允許的操作。攻擊者若有 `mustChangePassword=true` 的 CMS session，可在 GraphQL 查詢中以 fragment 名稱或 comment 包含 `updateUser` 等關鍵字，讓實際非允許的 mutation 通過攔截。

實際可利用性極低：需要具有 mustChangePassword 狀態的已登入 CMS 帳號，且其 GraphQL 操作本就已受 role-based access 限制。

#### 修補建議

改用 GraphQL AST parsing 識別 operation type，而非 substring 比對：

```typescript
import { parse, OperationDefinitionNode } from 'graphql'

// 解析查詢取得頂層 operation 的 selection set field names
try {
  const ast = parse(query)
  const defs = ast.definitions.filter(
    (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition'
  )
  const topLevelFields = defs.flatMap(d =>
    d.selectionSet.selections
      .filter((s): s is { name: { value: string } } => s.kind === 'Field')
      .map(s => s.name.value)
  )
  const isAllowed = topLevelFields.some(f => allowed.includes(f))
} catch {
  // parse 失敗視為不允許
}
```

---

### [NEW-003] AUTH-006 rate limit Map 未清理過期項目（低）

| 欄位 | 值 |
|---|---|
| 嚴重度 | 低（資源問題） |
| 信心程度 | 高 |
| 類別 | OWASP A04 不安全設計 |
| 受影響行號 | `packages/forum-cms/utils/login-logging.ts`（`passwordResetRateMap`） |

#### 說明

`passwordResetRateMap` 是 in-process Map，過期的 entry 只有在同一 key 再次被訪問時才會被覆寫。若攻擊者以大量不同 email+IP 組合嘗試密碼重設，Map 條目會無限增長，長期運行後可能造成記憶體壓力。

#### 修補建議

1. **短期**：加入定期清理（每小時清除過期項目）：
```typescript
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of passwordResetRateMap) {
    if (entry.expiresAt < now) passwordResetRateMap.delete(key)
  }
}, 60 * 60 * 1000)
```
2. **中期**：改用 Redis-backed 計數器（同時解決多 replica 一致性問題）。

---

## 殘餘風險摘要

以下為已知且接受的殘餘風險，不構成新 finding：

| 項目 | 說明 | 處置 |
|---|---|---|
| SC-001 Syft tag 可變 | `anchore/syft:v1.4.1` tag 非 immutable | 建議補加 `@sha256:<digest>` |
| CONFIG-001 scriptSrc unsafe-inline | Admin UI 短期需要 | 待收集 nonce 後收緊 |
| AUTH-006 in-process rate limit | 多 replica 無法共享 | 待改 Redis-backed |
| XSS-001/002 upstream package | lilith-draft-renderer 無 forum-cms active usage | 若引入需額外審查 |
