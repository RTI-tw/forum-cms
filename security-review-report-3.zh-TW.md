# Security Review: forum-cms（繁中台灣版）

## Scope 範圍

- Repository：`/Users/hcchien/rti/forum-cms`
- Reviewed commit：最新 main branch（含所有安全性修正）
- Scan id：`main_20260617`
- Review date：`2026-06-17`
- 範圍：全 repo 靜態資安審查，包含應用程式原始碼、Keystone lists/hooks、自訂 GraphQL 與 Express routes、generated Admin UI templates、upload/static storage、Docker/Cloud Build、package manifests。
- 明確涵蓋類別：OWASP Top Ten、XSS、SQL injection、SSRF、XXE、Prototype Pollution、dependency vulnerabilities、CSP、HSTS、Clickjacking、session、secret、file upload、BOLA 與資安設定錯誤。

---

## 審查背景

本次為第三次審查，前兩次審查共識別 26 個原始 findings 及 3 個再審發現（NEW-001～003），加上一次 Cloud Build 相容性問題（DEP-001 regression）。本次目的為驗證所有問題已完整修正，並全面掃描是否有新問題。

2026-06-09 部署邊界校準：`AC-006` 與 `AC-005` 在 GraphQL internal-only／ingress-only 前提下不再列為 active public findings；本報告保留其程式修正驗證作為 defense-in-depth 紀錄。若未來重新允許 public client 直接呼叫 GraphQL mutation，需重新評估並改以 bearer token member identity 綁定前台會員身分。

---

## Threat Model 威脅模型

與前次審查相同：Keystone 6 CMS/GraphQL API，後端 PostgreSQL/Prisma，整合 Firebase 會員身分、會員 JWT、CMS stateless sessions、GCS/local static assets、Pub/Sub、SMTP、Cloud Build 與 Docker image build steps。

---

## Findings 弱點項目

**掃描結論：未發現新的 reportable finding。**

所有前次識別的問題均已正確修正，修正本身未引入新的攻擊面。

---

## 修正驗證

### 原始 26 個 findings — 全部已修正 ✅

| ID | 嚴重度 | 說明 | 驗證結果 |
|---|---|---|---|
| AUTH-001 | 高 | 硬編碼 session/JWT secret fallback | ✅ |
| AC-006 | 高 | createComment 信任用戶端 member | ✅；GQL internal-only 時移出 active findings |
| AC-009 | 高 | Report 可隱藏任意文章留言 | ✅ |
| AC-010 | 高 | Editor 自行授予 OfficialMapping 權限 | ✅ |
| AC-008 | 高 | PollVote 缺少 poll/option/唯一性驗證 | ✅ |
| SC-001 | 高 | Cloud Build curl\|sh 安裝 Syft | ✅ |
| AC-001 | 中 | Comment query 洩漏 hidden/rejected 留言 | ✅ |
| AC-002 | 中 | Bookmark BOLA | ✅ |
| AC-003 | 中 | PollVote BOLA | ✅ |
| AC-004 | 中 | Poll/PollOption 草稿洩漏 | ✅ |
| AC-005 | 中 | createPost 信任用戶端 author/status | ✅；GQL internal-only 時移出 active findings |
| AC-007 | 中 | Bookmark mutation owner 缺失 | ✅ |
| AUTH-002 | 中 | Reset token 寫入 log | ✅ |
| AUTH-003 | 中 | Lockout 可被 name/prefix 觸發 | ✅ |
| AUTH-004 | 中 | mustChangePassword 僅靠 client-side redirect | ✅ |
| AUTH-005 | 中 | 會員 ban 後 JWT 仍有效 | ✅ |
| AUTH-006 | 中 | reCAPTCHA 停用時無 rate limit | ✅ |
| CONFIG-001 | 中 | 未設定 security headers | ✅ |
| DEP-001 | 中 | Production dependencies 含已知漏洞 | ✅ |
| FILE-001 | 中 | keywords.json 公開存取 | ✅ |
| FILE-002 | 中 | 圖片上傳 2GB buffering | ✅ |
| SC-002 | 中 | Dockerfile apt key 未 pin | ✅ |
| XSS-001 | 中 | Rich-text embedded-code（無 active usage） | ✅ |
| AUTH-007 | 低 | 會員註冊洩漏帳號狀態 | ✅ |
| XSS-002 | 低 | Rich-text link URL（無 active usage） | ✅ |
| XSS-003 | 低 | RECAPTCHA_SITE_KEY 字串插值 | ✅ |

### 再審發現 NEW-001～003 — 全部已修正 ✅

| ID | 嚴重度 | 說明 | 驗證結果 |
|---|---|---|---|
| NEW-001 | 中 | helmet CSP 阻擋 reCAPTCHA 外部腳本 | ✅ |
| NEW-002 | 低 | mustChangePassword substring bypass | ✅ |
| NEW-003 | 低 | rate limit Map 未清理過期項目 | ✅ |

### DEP-001 regression — 已修正 ✅

| 說明 | 驗證結果 |
|---|---|
| `http-proxy-middleware >=2.0.7` 解析至 v4.0.0，Node 20 不相容導致 Cloud Build 失敗 | ✅ 限制為 `>=2.0.7 <4.0.0` 後 build 成功 |

---

## 修正細節驗證

### DEP-001 regression

**驗證**：`package.json` resolution 為 `"http-proxy-middleware": ">=2.0.7 <4.0.0"`，正確排除 Node >=22.15.0 限定的 v4.x。直接依賴 `"http-proxy-middleware": "^2.0.3"` 不受影響，transitive 依賴被 resolution 限制在 Node 20 相容範圍。Cloud Build 已回報成功。

### NEW-001 CSP reCAPTCHA

**驗證**：helmet CSP 現包含：
- `scriptSrc`：`https://www.google.com`（api.js）、`https://www.gstatic.com`（widget assets）
- `connectSrc`：`https://www.google.com`（verification XHR）、`https://www.gstatic.com`
- `imgSrc`：`https://www.gstatic.com`（reCAPTCHA images）
- `frameSrc`：`https://www.google.com`（v2 iframe challenge）
- `frameAncestors: "'none'"`（防止本站被嵌入，與 frameSrc 不衝突）

reCAPTCHA v3（Admin UI 使用）及 v2 challenge 均已涵蓋。

### NEW-002 mustChangePassword regex

**驗證**：`new RegExp(`\\b${op}\\b`).test(query)` 對 `updateUser`、`endSession` 等操作名稱使用 word-boundary 匹配，確保 `myUpdateUser`、`updateUserFoo` 等子字串不會誤觸發允許條件。

### NEW-003 rate limit Map cleanup

**驗證**：`setInterval(() => { ... }, 3_600_000).unref()` 正確在模組載入時啟動，每小時掃描並刪除 `expiresAt < now` 的過期項目。`.unref()` 確保此 timer 不阻礙 Cloud Run 收到 SIGTERM 後的正常退出。

---

## 殘餘風險（已知且接受）

| 項目 | 說明 | 狀態 |
|---|---|---|
| SC-001 Syft tag 可變 | `anchore/syft:v1.4.1` tag 非 immutable digest pin | 接受；建議後續補 `@sha256:<digest>` |
| CONFIG-001 scriptSrc unsafe-inline | Admin UI 短期需要 inline script | 接受；待收集 nonce 後收緊 |
| AUTH-006 in-process rate limit | 多 replica 環境下各自計數 | 接受；建議長期換用 Redis-backed 計數器 |
| XSS-001/002 upstream package | `@mirrormedia/lilith-draft-renderer` 無 forum-cms active usage | 接受；若引入 richTextEditor field 需重新評估 |

---

## Suppressed Classes 已排除類別

- `SUP-SQLI-001`：未找到 first-party SQL injection sink（Prisma 結構化 filters）
- `SUP-SSRF-001`：外部 fetch 為固定 URL，preview proxy 未 mount
- `SUP-XXE-001`：未找到 first-party XML parser entry point
- `SUP-PP-001`：未找到 first-party prototype-pollution merge path
- `SUP-FILE-001`：未找到 active arbitrary file-read 或 path traversal sink

---

## 整體評估

本次掃描確認 forum-cms codebase 在目前 main branch 狀態下，所有已識別的安全問題均已正確修正。未發現新的 reportable finding。殘餘風險均已明確識別並有對應的後續改善方向。
