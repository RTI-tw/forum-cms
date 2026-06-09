# Security Review: forum-cms（繁中台灣版）

## Scope 範圍

- Repository：`/Users/hcchien/rti/forum-cms`
- Reviewed commit：`f7aab21`
- Scan id：`f7aab21_20260601140554`
- Review date：`2026-06-01 14:05:54 Asia/Taipei`
- 範圍：repo-wide 靜態資安審查，包含應用程式原始碼、Keystone lists/hooks、自訂 GraphQL 與 Express routes、generated Admin UI templates、upload/static storage、Docker/Cloud Build、package manifests，以及 dependency audit output。
- 明確涵蓋類別：OWASP Top Ten、XSS、SQL injection、SSRF、XXE、Prototype Pollution、dependency vulnerabilities、CSP、HSTS、Clickjacking、session、secret、file upload、BOLA 與資安設定錯誤。
- 不在 repo 內的動態 production 設定，例如 Cloud Run ingress/IAM、CDN/header injection、GCS object ACL 與實際 secret 值，視為 out of repo。
- 2026-06-09 部署邊界校準：若 production 已強制 `/api/graphql` 只接受 ingress/internal service traffic，且不允許 public client 直接呼叫 GraphQL，則 `[1]` / `[11]` 的 public API attack path 不成立，已自 active findings 移出；若未來重新將 GraphQL 對外公開，需重新啟用這兩項風險評估。

## Threat Model 威脅模型

本應用程式是 Keystone 6 CMS/GraphQL API，後端使用 PostgreSQL/Prisma，並整合 Firebase 會員身分、會員 JWT、CMS stateless sessions、GCS/local static assets、Pub/Sub、SMTP、Cloud Build 與 Docker image build steps。原始審查將 public/member clients 直接呼叫 GraphQL 納入威脅模型；部署邊界校準後，production 應讓 public client 透過前端/BFF/ingress 控制層進入，GraphQL 本身不得直接對外公開。其他主要信任邊界包含 CMS 使用者到 Admin UI/list mutations、bearer member tokens 到自訂 resolvers/hooks、operator-controlled environment variables 到 generated Admin UI code，以及 build workers 到遠端 package/install sources。

高價值資產包含 CMS 帳號與 sessions、會員身分與 JWT、reset tokens、文章/留言/檢舉/書籤/投票/票數、official-member mappings、forbidden keyword policy data、uploaded assets、production secrets 與 container/build artifacts。主要攻擊者模型包含在 exposed API modes 下的未登入 public API callers、已登入會員、低權限 CMS 使用者、log readers、遭入侵的 build-time dependencies，以及能影響 generated code 的 operators/CI variables。

## Findings 弱點項目

摘要：原始審查共列出 26 個 findings；依 2026-06-09 部署邊界校準，`[1]` / `[11]` 在 GraphQL internal-only 前提下自 active public findings 移出。校準後 active findings 為 24 個：高 5、中 16、低 3。未找到 first-party SQL injection、runtime user-controlled SSRF、first-party XXE parser 或 first-party prototype-pollution merge path；相關殘餘風險已納入下方 dependency 與 supply-chain findings。

### [1] （部署校準後移出 active findings）開放 API 的 createComment 信任用戶端提供的 member 關聯

| 欄位 | 值 |
|---|---|
| 嚴重度 | 原始：高；GQL internal-only：不列為 active finding |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-639, CWE-862 |
| 受影響行號 | packages/forum-cms/lists/comment.ts:143-149; packages/forum-cms/lists/comment.ts:190-208 |

#### Status 狀態

此項已自 active public findings 移出。原始問題只在 GraphQL/list mutation 可被 public client 直接呼叫時成立；若 production 已強制 GraphQL 只接受 ingress/internal service traffic，public attacker 沒有可達 entry point。程式碼也已移除先前非 CMS create 分支的 CMS-session 強制覆寫；目前僅在用戶端未明確指定 `member` 時，才嘗試以 `getOfficialMemberIdForSessionUser(context)` 做 CMS User -> Official Member 自動帶入，無 CMS session 時不會因此拋錯。

#### Summary 摘要

建立留言時，系統只會在用戶端省略 `member` 時才自動補上會員；若非 CMS 呼叫者明確送出 `member.connect`，且該 list 對外開放寫入，就能用其他會員身分建立留言。

#### Validation 驗證

hook 會檢查 `hasExplicitMemberRelationInput(inputData, member)`，一旦發現用戶端有明確提供 member 輸入，就跳過伺服器端的身分綁定。

#### Dataflow 資料流

API 呼叫者送出含有 `member.connect` 的 `createComment` -> hook 接受明確 member -> 以受害者 member id 建立留言。

#### Reachability 可達性

只有在 Comment 於 `gql`、`preview` 或 API `read_write` 模式對 public client 開放時可達。若 Cloud Run/IAM/IAP/內部 LB/ingress policy 已確保 `/api/graphql` 不被 public client 直接呼叫，此 attack path 不成立。

#### Severity 嚴重度

這會造成使用者產生內容的身分冒用，可能破壞帳號名譽，也可能讓受害者承擔後續審核處置。

#### Remediation 修補建議

維持 GraphQL internal-only 部署控制，並在 CI/CD 或 infra review 中驗證 Cloud Run ingress/IAM/IAP/內部 LB 設定。若未來重新允許前台會員直接呼叫 GraphQL mutation，應改用前台 bearer token 驗證出的會員覆寫 `member`，並拒絕未登入的 create；不可只依賴 CMS session mapping。

### [2] PollVote mutation 可破壞投票與彙總票數

| 欄位 | 值 |
|---|---|
| 嚴重度 | 高 |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A04 不安全設計 |
| CWE | CWE-862, CWE-345 |
| 受影響行號 | packages/forum-cms/lists/poll-vote.ts:47-79; packages/forum-cms/utils/poll-vote-count-sync.ts:54-72 |

#### Summary 摘要

PollVote 寫入 hook 會綁定 member，但在重新計算票數前，沒有驗證 poll 可見性、投票是否過期、唯一性，或所選 option 是否真的屬於該 poll。

#### Validation 驗證

非 CMS hook 在 create 時設定 `member`、update 時刪除 `member`，但仍讓 `poll` 與 `option` 由用戶端控制。同步工具接著依 `pollId` 和 `optionId` 計數並寫回彙總資料。

#### Dataflow 資料流

API 呼叫者用任意 poll/option id 建立或更新 PollVote -> row 被接受 -> 相關 poll/option 的彙總票數被重算。

#### Reachability 可達性

PollVote 開放寫入時可達。README 的 API 範例啟用 `PollVote: read_write`。

#### Severity 嚴重度

攻擊者可操控投票完整性與前台顯示的票數，包含製造跨 poll 的 option 不一致。

#### Remediation 修補建議

驗證 poll 可見性與期限，要求 option 必須隸屬於 poll，強制每位會員每個 poll 只有一筆有效票，並把投票與票數更新包在 transaction 中。

### [3] Report create/update 對外開放時可隱藏任意文章與留言

| 欄位 | 值 |
|---|---|
| 嚴重度 | 高 |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-862, CWE-285 |
| 受影響行號 | packages/forum-cms/lists/report.ts:90-97; packages/forum-cms/lists/report.ts:99-123; packages/forum-cms/lists/report.ts:124-177 |

#### Summary 摘要

Report 狀態轉換有副作用，會隱藏關聯的文章或留言；但 list 除了 operation access 外，沒有針對非 CMS 呼叫者做擁有者或審核權限檢查。

#### Validation 驗證

`afterOperation` 在 report 變成 `resolved` 時會把 `post` 或 `comment` 設為 `hidden`。此 list access 只透過 `allowRoles` 做 list operation 層級授權。

#### Dataflow 資料流

API 呼叫者 create/update Report，指定目標 post/comment 與 `status=resolved` -> hook 執行 -> 目標內容狀態變成 hidden。

#### Reachability 可達性

只有在 Report 寫入經由 `gql`、`preview` 或 API `read_write` 對外開放時可達；預設 CMS role-gated 模式下未登入者不可達。

#### Severity 嚴重度

若對外開放，這會變成未登入或弱驗證的內容下架能力，對公開內容完整性與可用性影響高。

#### Remediation 修補建議

Report 寫入維持 CMS-only，或把公開檢舉提交與審核 resolution 拆成不同流程。伺服器端把狀態改為 `resolved` 應要求 moderator/admin 權限。

### [4] Editor 可自行授予 OfficialMapping 審核權限

| 欄位 | 值 |
|---|---|
| 嚴重度 | 高 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A04 不安全設計 |
| CWE | CWE-266, CWE-269 |
| 受影響行號 | packages/forum-cms/lists/official-mapping.ts:26-33; packages/forum-cms/utils/cms-content-moderation.ts:77-87 |

#### Summary 摘要

OfficialMapping list 允許 editor 建立與更新 mapping，而內容審核邏輯又信任該 mapping 來判斷 CMS 使用者是否可編輯官方會員內容。

#### Validation 驗證

OfficialMapping operation access 包含 `editor` 的 query/update/create/delete。`canEditMappedMemberContent` 會比較 mapping 出來的 official member id 與內容 member id。

#### Dataflow 資料流

Editor 為自己建立或修改 mapping -> moderation helper 從 mapping 解析 official member id -> editor 取得該 member 內容的編輯權。

#### Reachability 可達性

任何 editor 角色的 CMS 使用者在 CMS content moderation 啟用時可達。

#### Severity 嚴重度

這是 CMS 角色內的權限提升，會繞過 editor 與帳號/內容擁有者之間原本預期的權責分離。

#### Remediation 修補建議

OfficialMapping mutation 限制為 admin-only，加入唯一性與稽核紀錄，且不要讓可由使用者編輯的 mapping 成為唯一的審核授權來源。

### [5] CMS 與會員 session 簽章金鑰存在硬編碼 fallback

| 欄位 | 值 |
|---|---|
| 嚴重度 | 高 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A02 加密機制失效, A07 身分識別與驗證失效 |
| CWE | CWE-798, CWE-321 |
| 受影響行號 | packages/forum-cms/environment-variables.ts:79-83; packages/forum-cms/environment-variables.ts:140-144; packages/forum-cms/utils/member-session.ts:9-15; packages/forum-cms/utils/member-session.ts:29-40; packages/forum-cms/keystone.ts:85 |

#### Summary 摘要

必要的 secret 環境變數缺漏時，服務會退回已知的靜態字串，用於 Keystone stateless CMS session 與會員 JWT。任何知道預設 secret 的人，都可能在受影響部署中偽造 token/cookie 冒用使用者。

#### Validation 驗證

`SESSION_SECRET` 預設為 literal string，`MEMBER_SESSION_SECRET` 預設為空 env 值，接著 `member-session.ts` 會套用硬編碼預設值。Keystone 與 `jsonwebtoken` 都用這些值簽章與驗證 session。

#### Dataflow 資料流

部署缺少 secret -> `envVar.session.secret` 或 `getSessionSecret()` -> `statelessSessions()` 或 `jwt.sign()`/`jwt.verify()` -> 被接受的 CMS/會員身分。

#### Reachability 可達性

任何未設定 secret 就啟動的環境都可達。這不只是開發環境的 footgun，因為 production code path 沒有 fail closed。

#### Severity 嚴重度

成功利用會造成帳號/session 偽造與直接權限提升。攻擊只需要知道原始碼中的預設值並能連到應用程式。

#### Remediation 修補建議

缺少高強度隨機 secret 時直接阻止啟動，強制長度/熵檢查，移除預設值，輪替既有 secret，並在輪替後撤銷現有 session。

### [6] Cloud Build 執行未 pin 版本的遠端 Syft installer

| 欄位 | 值 |
|---|---|
| 嚴重度 | 高 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A08 軟體與資料完整性失效 |
| CWE | CWE-494, CWE-829 |
| 受影響行號 | cloudbuild.yaml:36-44 |

#### Summary 摘要

建置流程會從 Syft GitHub `main` branch 下載 `install.sh`，並在 Cloud Build 中直接 pipe 給 `sh` 執行。

#### Validation 驗證

`cloudbuild.yaml` 執行 `curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin`，沒有 pin commit、checksum 或簽章。

#### Dataflow 資料流

Build worker -> 從可變 branch 即時網路抓取 -> shell 執行 -> SBOM 工具安裝到建置環境。

#### Reachability 可達性

每次 Cloud Build 執行 SBOM step 時都可達。

#### Severity 嚴重度

若 upstream、DNS/TLS 信任鏈或 branch 內容遭竄改，可能在 build-time 執行任意程式碼並影響 image/artifact。

#### Remediation 修補建議

以 immutable release pin Syft，驗證 checksum/signature，或改用已預先安裝 Syft 的可信 builder image。

### [7] 公開 comment query 可能洩漏 hidden 或 rejected 留言

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-200, CWE-285 |
| 受影響行號 | packages/forum-cms/lists/comment.ts:143-158; packages/forum-cms/README.md:83-132 |

#### Summary 摘要

非 CMS request 的 Comment query filter 只限制父層文章可見性，沒有限制留言本身的 status。

#### Validation 驗證

`Comment` filter 回傳 `{ post: buildPostVisibilityWhere(memberId) }`，沒有要求 `Comment.status = published`，也沒有套用 owner-aware hidden visibility。

#### Dataflow 資料流

API 查詢 comments -> list-level API/gql access 允許 query -> 父層 post visibility 符合 -> hidden/rejected comment rows 被回傳。

#### Reachability 可達性

`ACCESS_CONTROL_STRATEGY` 為 `gql`、`preview`，或 `api` 且 Comment query access 啟用時可達，README 也有文件化 API 部署模式。

#### Severity 嚴重度

已被審核處理的內容可能被不應看見的人讀取。這是資料外洩，而不是直接權限提升。

#### Remediation 修補建議

加入 comment status 與 owner-aware visibility filter，並用測試覆蓋 published、hidden、rejected、archived 狀態下的公開與個人頁查詢。

### [8] Bookmark query 的 BOLA 會洩漏其他會員書籤

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-639, CWE-200 |
| 受影響行號 | packages/forum-cms/lists/bookmark.ts:30-45; packages/forum-cms/README.md:134-140 |

#### Summary 摘要

Bookmark query access 只依文章可見性過濾，沒有依已驗證會員限制書籤擁有者。

#### Validation 驗證

`Bookmark` query filter 只回傳 `{ post: buildPostVisibilityWhere(memberId) }`；沒有 `member.id == authenticated member` 條件。

#### Dataflow 資料流

已登入或未登入 API 呼叫者查詢 bookmarks -> visible-post 條件通過 -> 回傳其他會員的 bookmark。

#### Reachability 可達性

Bookmark query access 在 `gql`、`preview` 或 `api` 模式啟用時可達。

#### Severity 嚴重度

書籤屬於使用者私人行為資料。外洩範圍受文章可見性限制，但沒有受擁有者限制。

#### Remediation 修補建議

非 CMS Bookmark query 加上 `member.id equals authenticatedMemberId`，除非有明確公開用途，否則拒絕未登入查詢。

### [9] PollVote query 的 BOLA 會洩漏其他會員投票

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-639, CWE-200 |
| 受影響行號 | packages/forum-cms/lists/poll-vote.ts:40-61 |

#### Summary 摘要

PollVote query filter 只檢查 poll 所屬文章可見性，沒有檢查 vote owner；update filter 才有 member 範圍限制。

#### Validation 驗證

`filter.query` 回傳 poll/post visibility 條件。擁有者 filter `{ member: { id: { equals: memberId } } }` 只存在於 update。

#### Dataflow 資料流

API 呼叫者查詢 PollVote -> poll 所屬文章可見性通過 -> 可讀取該 poll 上任何會員的 vote。

#### Reachability 可達性

PollVote query access 在 API/gql/preview 模式啟用時可達，包含文件範例中的 `PollVote: read_write`。

#### Severity 嚴重度

投票選擇是敏感個人資料。這是典型 object-level authorization failure。

#### Remediation 修補建議

非 CMS PollVote query 限制為已驗證會員本人，公開端只透過獨立欄位暴露彙總票數。

### [10] 直接查詢 Poll 與 PollOption 可能洩漏草稿或隱藏投票資料

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-200, CWE-285 |
| 受影響行號 | packages/forum-cms/lists/poll.ts:114-121; packages/forum-cms/lists/poll-option.ts:62-69 |

#### Summary 摘要

Poll 與 PollOption list 有 operation access，但沒有針對非 CMS query filter 把 row 綁回可見文章。

#### Validation 驗證

兩個 list 都只透過 `allowRoles` 設定 `operation.query`；沒有類似 post visibility 的 `filter.query`。

#### Dataflow 資料流

API/gql 查詢 Poll 或 PollOption -> list operation access 允許 query -> 不論父層文章是否可見，row 都可能被回傳。

#### Reachability 可達性

這些 list 在 `api` 模式啟用 query，或在全開的 `gql`/`preview` 模式下可達。

#### Severity 嚴重度

草稿/隱藏投票的 metadata 與選項可能洩漏未公開的編輯或審核狀態。

#### Remediation 修補建議

為 Poll 與 PollOption 加上會 traverse 到 `post` visibility 的 `filter.query`，沒有可見父層時拒絕孤兒/直接讀取。

### [11] （部署校準後移出 active findings）開放 API 的 createPost 信任用戶端提供的 author 與 status

| 欄位 | 值 |
|---|---|
| 嚴重度 | 原始：中；GQL internal-only：不列為 active finding |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-639, CWE-862 |
| 受影響行號 | packages/forum-cms/lists/Post.ts:117-125; packages/forum-cms/lists/Post.ts:216-227; packages/forum-cms/lists/Post.ts:373-389 |

#### Status 狀態

此項已自 active public findings 移出。原始問題只在 GraphQL/list mutation 可被 public client 直接呼叫時成立；若 production 已強制 GraphQL 只接受 ingress/internal service traffic，public attacker 沒有可達 entry point。程式碼也已移除先前非 CMS create 分支的 CMS-session 強制覆寫；目前 create hook 只在未明確指定 `author` 時，才嘗試以 `getOfficialMemberIdForSessionUser(context)` 做 CMS User -> Official Member 自動帶入，`status` 則回到既有的 server-side 預設值。

#### Summary 摘要

create hook 只在用戶端省略 author/status 時提供預設值。明確提供的 relationship input 與 status 會被信任。

#### Validation 驗證

`resolveInput` 只有在 `status` 是 undefined 時才設定預設值，也只有在沒有明確 `author` relation 時才 auto-connect official member。

#### Dataflow 資料流

API 呼叫者送出含 `author.connect` 與自選 `status` 的 `createPost` -> hook 看見明確 input -> 資料照要求寫入。

#### Reachability 可達性

只有 Post create 透過 `gql`、`preview` 或 API `read_write` 對 public client 開放時可達。預設 CMS 模式仍由 role gate 保護；若 Cloud Run/IAM/IAP/內部 LB/ingress policy 已確保 `/api/graphql` 不被 public client 直接呼叫，此 attack path 不成立。

#### Severity 嚴重度

若寫入 API 對外開放，呼叫者可冒用會員並可能以他人身分發布或隱藏內容。

#### Remediation 修補建議

維持 GraphQL internal-only 部署控制，並在 CI/CD 或 infra review 中驗證 Cloud Run ingress/IAM/IAP/內部 LB 設定。若未來重新允許前台會員直接呼叫 GraphQL mutation，應以 bearer token member identity 綁定 `author`，而不是只依賴 CMS session mapping；`status` 仍應由伺服器端控制。

### [12] Bookmark mutation 缺少擁有者隔離

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效 |
| CWE | CWE-639, CWE-862 |
| 受影響行號 | packages/forum-cms/lists/bookmark.ts:30-45 |

#### Summary 摘要

Bookmark access 有 query visibility filter，但非 CMS API 呼叫者的 create/update/delete 沒有 owner binding。

#### Validation 驗證

此 list 透過 `allowRoles` 定義 mutation 的 operation access，但沒有 `filter.update`、`filter.delete` 或 create hook 把 `member` 限制為已驗證會員。

#### Dataflow 資料流

具 Bookmark write access 的 API 呼叫者提供 member/post relation 或目標 id -> Keystone mutation 在沒有 owner predicate 的情況下執行。

#### Reachability 可達性

Bookmark 在 `api` 中啟用寫入，或在全開 `gql`/`preview` 模式下可達。

#### Severity 嚴重度

若此 list 對外開放，攻擊者可為其他會員建立、修改或刪除 bookmark record。

#### Remediation 修補建議

Bookmark create 綁定為已驗證會員，並為 update/delete 加上 `member.id` 必須符合 bearer identity 的 filter。

### [13] 密碼重設 URL（含 reset token）被寫入 log

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A02 加密機制失效, A09 資安記錄與監控失效 |
| CWE | CWE-532 |
| 受影響行號 | packages/forum-cms/utils/password-reset.ts:36-50 |

#### Summary 摘要

密碼重設信件 helper 會記錄完整 reset URL，包含 bearer reset token。能讀 log 的人可在 token 有效期間使用該 URL。

#### Validation 驗證

同一個放進 email body 的 `resetUrl`，也以 `resetUrl` 欄位寫入 structured `console.log`。

#### Dataflow 資料流

密碼重設請求 -> reset token 嵌入 `resetUrl` -> structured application log -> log aggregation/viewer 使用者。

#### Reachability 可達性

每次 CMS 密碼重設請求時都可達。Cloud/container logs 的讀取權限通常比密碼重設權限更廣。

#### Severity 嚴重度

此問題可能在 token 有效期間造成 CMS 帳號接管，但需要能讀取應用程式 log。

#### Remediation 修補建議

不要把 reset URL/token 寫入 log。只記錄 correlation id、目標 user id/email hash 與寄送狀態，並檢查歷史 log 是否有仍有效的 token 外洩。

### [14] 登入 lockout 可被 username 或 email prefix 觸發

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A07 身分識別與驗證失效 |
| CWE | CWE-307, CWE-400 |
| 受影響行號 | packages/forum-cms/utils/login-logging.ts:101-117; packages/forum-cms/utils/login-logging.ts:320-335; packages/forum-cms/utils/account-lockout.ts:82-95 |

#### Summary 摘要

登入失敗處理不只用精確 email 找 user，也會用精確 display name 與 email prefix 找 user。對該衍生身分重複失敗可鎖定真實帳號。

#### Validation 驗證

`findUserByIdentity` 建立 alternative filters，包含 `name equals`，且輸入不含 at sign 時加入 `email startsWith`，接著更新第一筆回傳 user 的 lockout counter。

#### Dataflow 資料流

攻擊者提交部分 identity -> fallback lookup 選到 user -> failed attempt accounting 更新該 user -> 達到 lockout threshold。

#### Reachability 可達性

public login mutation 在 authentication plugin 處理登入失敗時可達。

#### Severity 嚴重度

這是針對 CMS 使用者的可用性與騷擾問題。不會直接洩漏密碼，但可阻斷管理者登入。

#### Remediation 修補建議

lockout state 只使用 canonical exact login identifier，將 lockout counter 記在嘗試登入的 normalized email 上，並將 IP/device throttling 與 account lockout 分開。

### [15] 強制改密碼狀態主要靠 client-side redirect 執行

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A07 身分識別與驗證失效 |
| CWE | CWE-602, CWE-306 |
| 受影響行號 | packages/forum-cms/keystone.ts:2428-2451; packages/forum-cms/utils/login-logging.ts:367-374 |

#### Summary 摘要

被標記 `mustChangePassword` 或密碼過期的使用者只會收到瀏覽器端提示，但伺服器沒有阻擋該 session 的 API 操作。

#### Validation 驗證

Admin UI session check 有偵測條件，但註解明確表示依賴 client-side script redirect。Login logging 設定 `X-Require-Password-Change`，不是 authorization denial。

#### Dataflow 資料流

使用者完成驗證 -> session 帶有 password-change requirement -> browser header/script redirect -> 直接 GraphQL/API call 仍可使用 session。

#### Reachability 可達性

任何已登入 CMS 使用者只要能在 Admin UI redirect 流程外使用 session cookie 即可達。

#### Severity 嚴重度

此問題削弱密碼輪替與強制改密碼政策。影響取決於該使用者原本擁有的權限。

#### Remediation 修補建議

在 GraphQL/list operation access 與自訂 Express routes 中做 server-side 強制檢查；在改密碼完成前只允許 password update/logout/reset 相關操作。

### [16] 會員被 ban 或 delete 後，既有 JWT 到期前仍會被接受

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A07 身分識別與驗證失效 |
| CWE | CWE-613, CWE-285 |
| 受影響行號 | packages/forum-cms/keystone.ts:393-403; packages/forum-cms/keystone.ts:496-499; packages/forum-cms/keystone.ts:551-554; packages/forum-cms/utils/member-session.ts:29-40 |

#### Summary 摘要

會員 session 驗證只檢查 member row 是否存在，但不會對既有 bearer token 拒絕 banned/deleted/inactive 狀態。

#### Validation 驗證

registration/login 會阻擋不可用會員狀態，然後簽 JWT。後續 `currentMember` 驗證 JWT 並用 id 取回 member，但沒有套用同一個 status check。

#### Dataflow 資料流

有效會員 session token -> member status 改為 banned/deleted/inactive -> `verifyMemberSession` 成功 -> member id 仍可供 visibility filters 與 mutation 使用。

#### Reachability 可達性

直到 JWT 到期前都可達，尤其是用戶端在 moderation action 後持續使用已核發 bearer token 時。

#### Severity 嚴重度

審核處置可能在 token 生命週期內被延遲或繞過。若 member mutation 在 API mode 開放，影響會擴大。

#### Remediation 修補建議

每次 bearer-token authentication 都套用相同 blocked-status check，加入 token revocation/session versioning，並在狀態變更後縮短或輪替 token。

### [17] reCAPTCHA 關閉時，密碼重設沒有 server-side throttle

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A04 不安全設計, A07 身分識別與驗證失效 |
| CWE | CWE-307, CWE-770 |
| 受影響行號 | packages/forum-cms/environment-variables.ts:128; packages/forum-cms/utils/recaptcha.ts:29-35; packages/forum-cms/utils/login-logging.ts:155-181 |

#### Summary 摘要

密碼重設防護依賴 reCAPTCHA；但 reCAPTCHA 預設為關閉，而且關閉時會直接回傳成功，沒有獨立 rate limit。

#### Validation 驗證

必須 `RECAPTCHA_ENABLED === true` 才會執行驗證。關閉時 `verifyRecaptchaToken` 回傳 success，而 password-reset path 只檢查該結果。

#### Dataflow 資料流

未登入 reset request -> reCAPTCHA disabled -> verifier 回傳 success -> 可重複產生 reset email。

#### Reachability 可達性

預設/local-like 部署，或任何 production 環境未啟用 reCAPTCHA 時可達。

#### Severity 嚴重度

攻擊者可觀察操作行為並對使用者/郵件基礎設施發動 reset email flood。帳號接管仍需要取得 token。

#### Remediation 修補建議

依帳號、IP、subnet 與時間窗加入 server-side rate limit；reCAPTCHA 應作為額外訊號，而不是唯一控制。

### [18] 未明確設定 CSP、HSTS 或 clickjacking 防護 header

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A05 資安設定錯誤 |
| CWE | CWE-1021, CWE-693 |
| 受影響行號 | packages/forum-cms/keystone.ts:2328-2344; packages/forum-cms/keystone.ts:2354-2358; packages/forum-cms/keystone.ts:2478-2482 |

#### Summary 摘要

Express/Keystone server 設定沒有安裝 security header middleware，也沒有定義 CSP、HSTS、frame-ancestors/X-Frame-Options 或相關瀏覽器防護。

#### Validation 驗證

搜尋未找到 `helmet`、`Content-Security-Policy`、`Strict-Transport-Security`、`X-Frame-Options` 或 `frame-ancestors` 設定。custom Document 的 `<Head />` 是空的，`extendExpressApp` 只加入 JSON parsing 與 routes。

#### Dataflow 資料流

CMS/Admin/GraphQL route 的 HTTP response -> 沒有明確 browser security headers -> 瀏覽器使用寬鬆預設值或只依賴平台外部注入 header。

#### Reachability 可達性

除非 Cloud Run/load balancer/CDN 在 repo 外注入等效 header，否則會影響部署後 response。此類外部設定不在本 repo 中。

#### Severity 嚴重度

缺少 CSP 會放大 XSS 影響；缺少 frame protection 會造成 clickjacking 風險；缺少 HSTS 則削弱 HTTPS downgrade resistance。若部署層有補償控制，嚴重度可下降。

#### Remediation 修補建議

集中加入 security headers，包含 Admin UI 的 nonce/hash-based CSP、`frame-ancestors none` 或允許來源、HTTPS 上的 HSTS、`X-Content-Type-Options nosniff`，並加上 header assertion tests。

### [19] Production dependency tree 含 critical prototype-pollution、RCE、XXE 與 DoS advisories

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A06 易受攻擊且過時的元件 |
| CWE | CWE-1321, CWE-611, CWE-94, CWE-400 |
| 受影響行號 | packages/forum-cms/package.json:35; packages/forum-cms/yarn.lock:5869-5878; packages/forum-cms/yarn.lock:6503-6505; packages/forum-cms/yarn.lock:6565-6572; packages/forum-cms/yarn.lock:7956-7958; packages/forum-cms/yarn.lock:8373-8393 |

#### Summary 摘要

`yarn audit --groups dependencies` 回報多個 production dependency advisories，包含 protobufjs 的 prototype pollution/RCE、fast-xml-parser 的 XML parser 問題、immutable prototype pollution、http-proxy-middleware DoS，以及 node-forge cryptographic parser 問題。

#### Validation 驗證

audit output 已存於 `artifacts/01_context/yarn_audit.jsonl`。lockfile 證據顯示 vulnerable packages 存在於 resolved dependency graph。

#### Dataflow 資料流

應用程式 dependency resolution -> 有弱點的 transitive packages 安裝到 production image -> 若應用程式或 dependency code 會解析攻擊者控制的 protobuf/XML/crypto/proxy input，弱點可被觸發。

#### Reachability 可達性

本次審查未逐一證明每個 advisory 都能從 first-party route 觸發，因此即使 advisory 分數有 critical，這裡仍評為中。部分 package 由服務使用的 Firebase/GCP/AWS libraries 帶入。

#### Severity 嚴重度

過時 production dependencies 是持續性風險，也包含這次明確要求檢查的 prototype pollution 與 XXE-style XML parser 問題。

#### Remediation 修補建議

升級 direct packages 與 lockfile，在 CI 執行 audit，優先採用 patched major/minor 版本，並對 protobuf/XML/crypto path 做 reachability testing 後再接受殘餘風險。

### [20] 公開 keywords.json 洩漏受限制的審核關鍵字資料

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A02 加密機制失效 |
| CWE | CWE-200, CWE-668 |
| 受影響行號 | packages/forum-cms/lists/forbidden-keyword.ts:60-67; packages/forum-cms/utils/forbidden-keywords-json.ts:71-75; packages/forum-cms/utils/forbidden-keywords-json.ts:101-111; packages/forum-cms/keystone.ts:2458-2467 |

#### Summary 摘要

受限制的 ForbiddenKeyword records 透過 `context.sudo()` 匯出成 `keywords.json`，而 local file storage 會公開服務 `/files`。

#### Validation 驗證

list 本身有 role 限制，但 sync helper 用 sudo 讀取 enabled keywords，並把 JSON 寫到 local file storage 與 GCS。Keystone 在 `/files` 公開 local `files` storage。

#### Dataflow 資料流

moderator/editor keyword data -> sudo export -> file storage 中的 local `keywords.json` -> 未登入 `/files/keywords.json` consumer。

#### Reachability 可達性

local-storage 部署可達；若該檔案被下游發布，等效 public GCS object access 也可能可達。

#### Severity 嚴重度

攻擊者可得知審核關鍵字與豁免資料，更容易規避過濾，也會曝光營運政策。

#### Remediation 修補建議

不要把受限制的審核資料放在 public file storage。改提供最小化且 access-controlled 的 policy API，或把關鍵字比對留在伺服器端。

### [21] 圖片上傳上限允許驗證前的大量記憶體 buffering

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A05 資安設定錯誤, A08 軟體與資料完整性失效 |
| CWE | CWE-400 |
| 受影響行號 | packages/forum-cms/lists/image.ts:20-23; packages/forum-cms/keystone.ts:2478-2481 |

#### Summary 摘要

伺服器允許約 2GB 的 upload，而 image field 與 Keystone upload handling 會在相當多 request processing 後才驗證。

#### Validation 驗證

`maxFileSize` 設為 `2000 * 1024 * 1024`，image list 使用 Keystone local image storage，沒有更嚴格的 per-field cap。

#### Dataflow 資料流

已驗證 upload request -> server limit 接受大型 multipart body -> image handling buffering/processing data -> 記憶體/CPU/磁碟壓力。

#### Reachability 可達性

具有 image record create/update 權限的角色可達。預設 CMS role gating 降低暴露面，但無法消除內部人員或遭入侵帳號造成 DoS 的風險。

#### Severity 嚴重度

在有 memory limit 的 container 部署中，可用性風險可信。攻擊需要有圖片上傳權限的帳號。

#### Remediation 修補建議

設定實際合理的 upload limit，強制 reverse-proxy/body limits，盡量 stream upload，提早驗證 content type，並加入 per-user upload rate limit。

### [22] Dockerfile 在 root package install 前匯入未 pin 的 apt trust key

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A08 軟體與資料完整性失效 |
| CWE | CWE-494, CWE-829 |
| 受影響行號 | packages/forum-cms/Dockerfile:3-18 |

#### Summary 摘要

image build 會透過網路抓取 Google apt key 並用 `apt-key` 加入信任，接著安裝 `gcsfuse`。

#### Validation 驗證

Dockerfile 將 `curl https://packages.cloud.google.com/apt/doc/apt-key.gpg` pipe 到 `apt-key add -`，之後以 root 安裝 packages。

#### Dataflow 資料流

Docker build -> network-fetched trust key -> apt repository trust -> root package installation。

#### Reachability 可達性

每次使用此 Dockerfile 建置 image 時都可達。

#### Severity 嚴重度

這是 supply-chain hardening 問題。TLS 可降低風險，但 trust anchor 與 package source 沒有 pin 到 immutable digest/keyring package。

#### Remediation 修補建議

使用 distro-supported keyring files 搭配 `signed-by`，可行時 pin package versions，驗證 key fingerprints，並考慮使用已預裝必要相依套件的 base image。

### [23] Rich-text embedded-code block 會在套件使用者端執行 stored scripts

| 欄位 | 值 |
|---|---|
| 嚴重度 | 中 |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A03 Injection, XSS |
| CWE | CWE-79 |
| 受影響行號 | packages/core/src/custom-fields/rich-text-editor/index.ts:49-59; packages/core/src/custom-fields/rich-text-editor/views/readr/index.tsx:9-13; packages/core/src/custom-fields/rich-text-editor/views/mirrormedia/index.tsx:9-13; node_modules/@mirrormedia/lilith-draft-renderer/lib/website/readr/block-renderers/embedded-code-block.js:83-116 |

#### Summary 摘要

共用 rich-text custom field 儲存原始 Draft.js JSON，並把使用者串到會執行 embedded-code scripts 的 lilith rich-text renderers。

#### Validation 驗證

此 field 接受 GraphQL JSON input 並匯入 lilith editors。renderer 會從 embedded code 抽出 script nodes，建立 `<script>` elements、append 進 DOM，並用 `dangerouslySetInnerHTML` 注入非 script HTML。

#### Dataflow 資料流

editor/user-controlled rich-text JSON -> embedded-code block data -> renderer 重建 script elements 與 HTML -> 瀏覽器在 consuming origin 執行 script。

#### Reachability 可達性

目前沒有 active `forum-cms` list 呼叫 `richTextEditor(`，因此這是 repository package-consumer finding，而不是已證明的 forum-cms runtime path。

#### Severity 嚴重度

若 consuming list 讓不可信或較低權限作者使用此 field，就會變成具有 origin-level script execution 的 stored XSS。

#### Remediation 修補建議

不可信作者停用 embedded-code，server-side sanitize/allowlist embeds，以 sandboxed iframe render embeds，並強制可阻擋 inline script 的 CSP。

### [24] 會員註冊會揭露 email、customId 與 blocked account 狀態

| 欄位 | 值 |
|---|---|
| 嚴重度 | 低 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A01 權限控管失效, A04 不安全設計 |
| CWE | CWE-203, CWE-209 |
| 受影響行號 | packages/forum-cms/keystone.ts:457-486; packages/forum-cms/keystone.ts:496-499 |

#### Summary 摘要

註冊流程對 duplicate custom id、duplicate email 與 blocked member account 回傳可區分的錯誤訊息。

#### Validation 驗證

resolver 會依不同 lookup 結果丟出 `Custom ID already exists`、`Email already exists` 與 blocked-account 訊息。

#### Dataflow 資料流

攻擊者控制 registration fields -> resolver 檢查既有 member records -> 特定錯誤文字揭露帳號狀態。

#### Reachability 可達性

Firebase token validation 後，可從 member registration mutation 觸發。

#### Severity 嚴重度

這是帳號列舉/隱私問題，不是直接 compromise。

#### Remediation 修補建議

回傳通用註冊失敗訊息，把詳細原因留在受限 log，並考慮對註冊嘗試加入 abuse throttling。

### [25] Rich-text link URL 缺少 scheme allowlist

| 欄位 | 值 |
|---|---|
| 嚴重度 | 低 |
| 信心程度 | 中 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A03 Injection, XSS |
| CWE | CWE-79, CWE-601 |
| 受影響行號 | packages/core/src/custom-fields/rich-text-editor/index.ts:49-59; node_modules/@mirrormedia/lilith-draft-renderer/lib/website/readr/entity-decorators/link-decorator.js:40-47; node_modules/@mirrormedia/lilith-draft-renderer/lib/website/mirrormedia/entity-decorators/link-decorator.js:73-75 |

#### Summary 摘要

Rich-text link entities 會把儲存的 URL 值直接放進 anchor `href`，沒有看到 scheme allowlist。

#### Validation 驗證

Renderer decorators 從 entity data 讀取 `url` 並 render 成 `href`。READr renderer 也使用 `target=_blank` 但沒有 `rel` attribute。

#### Dataflow 資料流

stored rich-text link entity -> renderer `href` -> 使用者點擊後，依瀏覽器行為可能導向不安全 scheme 或 phishing destination。

#### Reachability 可達性

與 XSS-001 相同，目前沒有找到 active forum-cms list usage。風險適用於 expose rich-text field 的 package consumers。

#### Severity 嚴重度

現代 React/瀏覽器在許多情況下限制自動 script execution，因此嚴重度低於 embedded script blocks，但仍需要 URL policy。

#### Remediation 修補建議

normalize 並 allowlist `http`、`https` 與核准的 internal schemes；拒絕或重寫 `javascript:`、`data:` 與 control-character variants；new tab 加上 `rel=noopener noreferrer`。

### [26] RECAPTCHA_SITE_KEY 未經 JS escape 就插入 generated Admin UI TSX

| 欄位 | 值 |
|---|---|
| 嚴重度 | 低 |
| 信心程度 | 高 |
| 信心評估依據 | 靜態原始碼證據含明確行號；可達性假設列於下方。 |
| 類別 | OWASP A03 Injection, 資安設定錯誤 |
| CWE | CWE-79, CWE-94 |
| 受影響行號 | packages/forum-cms/environment-variables.ts:129; packages/forum-cms/keystone.ts:1040-1064; packages/forum-cms/keystone.ts:1622-1696 |

#### Summary 摘要

reCAPTCHA site key 以字串插值方式放進 generated Admin UI TypeScript，而不是使用 JavaScript string encoder。

#### Validation 驗證

generated scripts 內有 `const RECAPTCHA_SITE_KEY = '${RECAPTCHA_SITE_KEY}';`，其他 generated code 則有使用 JSON serialization 做較安全的嵌入。

#### Dataflow 資料流

operator-controlled environment variable -> generated Admin UI source -> browser-executed JavaScript。

#### Reachability 可達性

需要控制部署環境變數，一般使用者不能遠端利用。不過在 CI/CD 或 secret management channel 被入侵時，仍可能造成 script injection 或 build breakage。

#### Severity 嚴重度

operator-controlled injection 的直接可利用性低，但若設定供應鏈遭入侵，影響範圍高。

#### Remediation 修補建議

使用 `JSON.stringify` 或等效 JS string escaping 來嵌入來自環境的字串，並在啟動時驗證 site key 格式。

## Reviewed Surfaces 已審查範圍

- Keystone list operation access、filters、create/update hooks 與 relationship ownership checks。
- 會員/CMS authentication、JWT/session signing、password reset、lockout、reCAPTCHA 與 forced password-change flows。
- Admin UI generated templates、custom field views、rich text renderer integration 與 link/embed rendering sinks。
- Static file/image storage、forbidden keyword export、upload size limits 與 GCS/local storage behavior。
- Translation、content export、Pub/Sub、reCAPTCHA、preview proxy、cache invalidation、Docker 與 Cloud Build 的 external request surfaces。
- Query construction、Prisma raw API usage、JSON/filter merging、XML parser usage 與 prototype-pollution patterns。
- `yarn audit --groups dependencies --json` production dependency scan。

## Suppressed Classes 已排除類別

- `SUP-SQLI-001` 未找到 first-party SQL injection sink：在應用程式原始碼中未找到 $queryRaw、$executeRaw、Prisma.sql 或字串拼接 SQL；資料存取主要使用 Prisma/Keystone 結構化 filters。
- `SUP-SSRF-001` 未找到 runtime user-controlled SSRF sink：外部 fetch 為固定 Google/reCAPTCHA/PubSub URL，或 operator env endpoints 搭配固定 path；preview proxy 程式存在但未 mount。
- `SUP-XXE-001` 未找到 first-party XML parser entry point：應用程式原始碼中未找到 XML parser construction。XML/XXE 風險保留在 DEP-001 的 dependency advisories。
- `SUP-PP-001` 未找到 first-party prototype-pollution merge path：未找到不安全 deep merge user-controlled objects。API rule JSON 只接受白名單列舉 access levels；relationship where merging 使用明確 AND arrays。
- `SUP-FILE-001` 未找到 active arbitrary file-read 或 path traversal sink：Image upload storage 使用 Keystone naming/content handling；custom GCS file adapter 存在但未找到 active import/call path。

## Artifacts 產出檔案

- Discovery report：`/tmp/codex-security-scans/forum-cms/f7aab21_20260601140554/artifacts/02_discovery/finding_discovery_report.md`
- Work ledger：`/tmp/codex-security-scans/forum-cms/f7aab21_20260601140554/artifacts/02_discovery/work_ledger.jsonl`
- Coverage ledger：`/tmp/codex-security-scans/forum-cms/f7aab21_20260601140554/artifacts/03_coverage/repository_coverage_ledger.md`
- Dedupe report：`/tmp/codex-security-scans/forum-cms/f7aab21_20260601140554/artifacts/04_reconciliation/dedupe_report.md`
- Finding validation artifacts：`/tmp/codex-security-scans/forum-cms/f7aab21_20260601140554/artifacts/05_findings`
