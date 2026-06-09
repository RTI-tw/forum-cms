# 程式碼修正建議

依據 `security-review-report.zh-TW.md` 與 `security-review-validation-summary.zh-TW.md`，
針對各 finding 提出具體程式碼修正方式，按嚴重度排列。

2026-06-09 部署邊界校準：`AC-006` 與 `AC-005` 在 GraphQL internal-only／ingress-only 前提下已自 active public findings 移出。下列修正建議保留為 defense-in-depth 與「未來若重新公開 GraphQL」時的參考；若要支援前台會員直接呼叫 mutation，身分綁定應使用 bearer token member identity，而不是 Keystone CMS session mapping。

---

## 高嚴重度

---

### AUTH-001｜CMS 與會員 session 簽章金鑰存在硬編碼 fallback

**受影響檔案**
- `packages/forum-cms/environment-variables.ts:79-83, 140-144`
- `packages/forum-cms/utils/member-session.ts:9-15`
- `packages/forum-cms/keystone.ts:85`

**問題**：缺少 secret 時退回已知靜態字串，任何人只要看過原始碼都能偽造 session/JWT。

**修正方式**：在服務啟動時立即驗證，缺少或強度不足就直接拋錯中止。

```typescript
// packages/forum-cms/environment-variables.ts

// 於 envVar 物件建立後立即呼叫
function assertRequiredSecrets() {
  const SESSION_SECRET = process.env.SESSION_SECRET ?? ''
  const MEMBER_SESSION_SECRET = process.env.MEMBER_SESSION_SECRET ?? ''
  const errors: string[] = []

  if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET 必須設定且長度至少 32 字元')
  }
  if (!MEMBER_SESSION_SECRET || MEMBER_SESSION_SECRET.length < 32) {
    errors.push('MEMBER_SESSION_SECRET 必須設定且長度至少 32 字元')
  }
  if (errors.length > 0) {
    throw new Error(
      `[啟動失敗] 缺少必要 secret 設定：\n${errors.join('\n')}`
    )
  }
}

assertRequiredSecrets()
```

```typescript
// packages/forum-cms/utils/member-session.ts

// 移除硬編碼 fallback，改為直接讀取並在值不存在時拋錯
function getSessionSecret(): string {
  const secret = envVar.memberSession.secret
  if (!secret || secret.length < 32) {
    throw new Error('MEMBER_SESSION_SECRET 未設定或強度不足，服務無法啟動')
  }
  return secret
}
```

```typescript
// packages/forum-cms/environment-variables.ts（session 區塊）

// 移除 fallback 字串
session: {
  secret: SESSION_SECRET,  // 不再有 || 'default_session_secret_...'
  maxAge: ...,
},
memberSession: {
  secret: MEMBER_SESSION_SECRET,  // 不再有 || ''
  ...
},
```

---

### AC-006｜createComment 信任用戶端提供的 member 關聯

**受影響檔案**
- `packages/forum-cms/lists/comment.ts:190-208`

**問題**：`hasExplicitMemberRelationInput` 為 true 時，hook 完全信任用戶端傳入的 `member.connect`，
可讓任何已登入用戶以其他會員身分建立留言。

**修正方式**：若 GraphQL 重新對 public/member client 開放，非 CMS 呼叫時應一律強制覆寫為已驗證的 member id，並拒絕未登入建立。現行 `getOfficialMemberIdForSessionUser(context)` 是 Keystone CMS User -> Official Member mapping；它適合 CMS/internal flow，不是前台 bearer token 驗證。

```typescript
// packages/forum-cms/lists/comment.ts（resolveInput hook）

resolveInput: async ({ resolvedData, operation, context, inputData, item }) => {
  const data = { ...resolvedData }

  if (operation === 'create') {
    if (!isCmsRequest(context)) {
      // 無論用戶端是否傳入 member，一律從 bearer token 取得並覆寫
      const memberId = getAuthenticatedMemberId(context)
      if (memberId == null) {
        throw new Error('建立留言需要有效的會員登入狀態')
      }
      data.member = { connect: { id: memberId } }
    }
  }

  // ... 原有 update 邏輯不變
},
```

---

### AC-009｜Report create/update 對外開放時可隱藏任意文章與留言

**受影響檔案**
- `packages/forum-cms/lists/report.ts:90-97`

**問題**：Report list 只有 role-based operation access，非 CMS 呼叫者可直接 create/update
並把 status 設為 `resolved`，觸發 afterOperation hook 隱藏任意內容。

**修正方式**：在 access filter 層阻擋非 CMS 的 mutation，讓 `resolved` 狀態只能由具權限的 CMS 使用者設定。

```typescript
// packages/forum-cms/lists/report.ts

access: {
  operation: {
    query:   allowRoles(admin, moderator, editor),
    update:  allowRoles(admin, moderator, editor),
    create:  allowRoles(admin, moderator, editor),
    delete:  allowRoles(admin, editor),
  },
  // 新增：非 CMS 來源一律拒絕 mutation
  filter: {
    query: ({ context }) => {
      if (isCmsRequest(context)) return true
      return false  // 非 CMS 無法查詢 Report
    },
  },
},
hooks: {
  validateInput: ({ resolvedData, addValidationError, context, operation }) => {
    // 非 CMS 呼叫時直接拒絕（雙重防護）
    if (!isCmsRequest(context)) {
      addValidationError('Report 操作僅限 CMS 管理者')
      return
    }
    // ... 原有 validateInput 邏輯
  },
  // ... afterOperation 不變
},
```

---

### AC-010｜Editor 可自行授予 OfficialMapping 審核權限

**受影響檔案**
- `packages/forum-cms/lists/official-mapping.ts:26-33`

**問題**：`editor` 角色可建立與更新 OfficialMapping，而 moderation 邏輯信任該 mapping 來授予編輯權，
造成 editor 可替自己提升權限。

**修正方式**：OfficialMapping mutation 限制為 `admin` only。

```typescript
// packages/forum-cms/lists/official-mapping.ts

access: {
  operation: {
    query:   allowRoles(admin, editor),  // 查詢可保留 editor
    update:  allowRoles(admin),          // 僅 admin 可修改
    create:  allowRoles(admin),          // 僅 admin 可建立
    delete:  allowRoles(admin),          // 僅 admin 可刪除
  },
},
```

---

### AC-008｜PollVote mutation 可破壞投票與彙總票數

**受影響檔案**
- `packages/forum-cms/lists/poll-vote.ts:47-79`
- `packages/forum-cms/utils/poll-vote-count-sync.ts:54-72`

**問題**：建立投票時沒有驗證 poll 是否可見/未過期、option 是否屬於該 poll、每人每 poll 限一票。

**修正方式**：在 `validateInput` hook 加入伺服器端校驗。

```typescript
// packages/forum-cms/lists/poll-vote.ts（新增 validateInput hook）

hooks: {
  validateInput: async ({ resolvedData, operation, addValidationError, context }) => {
    if (isCmsRequest(context)) return  // CMS 跳過

    if (operation === 'create') {
      const pollConnect = (resolvedData.poll as { connect?: { id: number } })?.connect
      const optionConnect = (resolvedData.option as { connect?: { id: number } })?.connect

      if (!pollConnect?.id || !optionConnect?.id) {
        addValidationError('必須指定 poll 與 option')
        return
      }

      const pollId = pollConnect.id
      const optionId = optionConnect.id
      const memberId = getAuthenticatedMemberId(context)

      // 1. 驗證 poll 存在且可見（需 traverse 到 post visibility）
      const poll = await context.prisma.poll.findFirst({
        where: {
          id: pollId,
          post: buildPostVisibilityWhere(memberId) as object,
        },
        select: { id: true },
      })
      if (!poll) {
        addValidationError('投票不存在或不可參與')
        return
      }

      // 2. 驗證 option 確實屬於此 poll
      const option = await context.prisma.pollOption.findFirst({
        where: { id: optionId, pollId },
        select: { id: true },
      })
      if (!option) {
        addValidationError('選項不屬於此投票')
        return
      }

      // 3. 每人每 poll 限一票
      const existingVote = await context.prisma.pollVote.findFirst({
        where: { pollId, memberId: memberId as string },
        select: { id: true },
      })
      if (existingVote) {
        addValidationError('每位會員每個投票只能投一票')
      }
    }
  },
  resolveInput: ...,  // 原有邏輯不變
},
```

---

### SC-001｜Cloud Build 執行未 pin 版本的遠端 Syft installer

**受影響檔案**
- `cloudbuild.yaml:36-44`

**問題**：直接 curl | sh 執行 GitHub main branch 的安裝腳本，沒有 pin 版本或驗證完整性。

**修正方式**：改為指定固定版本並驗證 checksum。

```yaml
# cloudbuild.yaml（Generate SBOM step）

- name: gcr.io/cloud-builders/docker
  id: Generate SBOM
  entrypoint: bash
  args:
    - '-c'
    - |
      # Pin Syft 到特定版本，並驗證 checksum
      SYFT_VERSION="1.4.1"
      SYFT_CHECKSUM="<在 https://github.com/anchore/syft/releases 取得 syft_${SYFT_VERSION}_linux_amd64.tar.gz 的 SHA256>"
      curl -sSfL "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_amd64.tar.gz" \
        -o /tmp/syft.tar.gz
      echo "${SYFT_CHECKSUM}  /tmp/syft.tar.gz" | sha256sum -c -
      tar -xzf /tmp/syft.tar.gz -C /usr/local/bin syft
      syft gcr.io/$PROJECT_ID/$_IMAGE_NAME:${BRANCH_NAME}_${SHORT_SHA} \
        -o spdx-json \
        --file /workspace/sbom.spdx.json
```

或者，改用官方預建的 Syft container image（更安全）：

```yaml
- name: anchore/syft:v1.4.1
  id: Generate SBOM
  args:
    - 'gcr.io/$PROJECT_ID/$_IMAGE_NAME:${BRANCH_NAME}_${SHORT_SHA}'
    - '-o'
    - 'spdx-json'
    - '--file'
    - '/workspace/sbom.spdx.json'
```

---

## 中嚴重度

---

### AC-001｜公開 comment query 洩漏 hidden/rejected 留言

**受影響檔案**
- `packages/forum-cms/lists/comment.ts:151-158`

**修正方式**：filter.query 同時限制留言本身的 status。

```typescript
filter: {
  query: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    return {
      post: buildPostVisibilityWhere(memberId),
      // 新增：只回傳公開留言，或本人的留言
      OR: [
        { status: { equals: 'published' } },
        ...(memberId ? [{ member: { id: { equals: memberId } }, status: { in: ['published', 'archived'] } }] : []),
      ],
    }
  },
},
```

---

### AC-002｜Bookmark query BOLA 洩漏其他會員書籤

**受影響檔案**
- `packages/forum-cms/lists/bookmark.ts:38-44`

**修正方式**：非 CMS query 必須帶入 member owner 條件，且拒絕未登入查詢。

```typescript
filter: {
  query: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    if (!memberId) return false  // 拒絕未登入
    return {
      member: { id: { equals: memberId } },  // 僅回傳本人書籤
      post: buildPostVisibilityWhere(memberId),
    }
  },
},
```

同時補上 mutation 的 owner 綁定（對應 AC-007）：

```typescript
hooks: {
  resolveInput: ({ resolvedData, operation, context }) => {
    if (isCmsRequest(context)) return resolvedData
    const memberId = getAuthenticatedMemberId(context)
    if (!memberId) throw new Error('書籤操作需要登入')
    const data = { ...resolvedData }
    if (operation === 'create') {
      data.member = { connect: { id: memberId } }
    }
    return data
  },
},
// 並在 access.filter 加入 update/delete 的 owner 條件
filter: {
  query: ...,
  update: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    if (!memberId) return false
    return { member: { id: { equals: memberId } } }
  },
  delete: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    if (!memberId) return false
    return { member: { id: { equals: memberId } } }
  },
},
```

---

### AC-003｜PollVote query BOLA 洩漏其他會員投票

**受影響檔案**
- `packages/forum-cms/lists/poll-vote.ts:46-55`

**修正方式**：query filter 加入 member owner 條件。

```typescript
filter: {
  query: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    if (!memberId) return false  // 拒絕未登入
    return {
      member: { id: { equals: memberId } },  // 僅回傳本人投票
      poll: { post: buildPostVisibilityWhere(memberId) },
    }
  },
  update: ...,  // 原有不變
},
```

---

### AC-004｜直接查詢 Poll/PollOption 可能洩漏草稿投票

**受影響檔案**
- `packages/forum-cms/lists/poll.ts:114-121`
- `packages/forum-cms/lists/poll-option.ts:62-69`

**修正方式**：加入 filter.query，traverse 到 post visibility。

```typescript
// poll.ts
filter: {
  query: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    return {
      post: buildPostVisibilityWhere(memberId),
    }
  },
},

// poll-option.ts
filter: {
  query: ({ context }) => {
    if (isCmsRequest(context)) return true
    const memberId = getAuthenticatedMemberId(context)
    return {
      poll: {
        post: buildPostVisibilityWhere(memberId),
      },
    }
  },
},
```

---

### AC-005｜createPost 信任用戶端提供的 author 與 status

**受影響檔案**
- `packages/forum-cms/lists/Post.ts:216-227`

**修正方式**：若 GraphQL 重新對 public/member client 開放，非 CMS request 一律忽略用戶端傳入的 author/status，強制由 bearer token member identity 決定 author，status 由 server-side workflow 決定。現行 `getOfficialMemberIdForSessionUser(context)` 是 Keystone CMS User -> Official Member mapping，只適合 CMS/internal flow。

```typescript
resolveInput: async ({ resolvedData, operation, context }) => {
  const data = { ...resolvedData }

  if (operation === 'create' && !isCmsRequest(context)) {
    // 強制覆寫 author，忽略用戶端傳入
    const memberId = getAuthenticatedMemberId(context)
    if (memberId == null) throw new Error('發文需要有效的會員登入狀態')
    data.author = { connect: { id: memberId } }

    // 強制覆寫 status，用戶端不能自設
    if (data.status === undefined || data.status !== 'draft') {
      data.status = 'draft'  // 新文章一律從 draft 開始，由 CMS 審核後發布
    }
  }

  return data
},
```

---

### AUTH-002｜密碼重設 URL（含 reset token）被寫入 log

**受影響檔案**
- `packages/forum-cms/utils/password-reset.ts:43-52`

**修正方式**：log 中移除 `resetUrl`，只保留 correlation 資訊。

```typescript
// 修改前
console.log(JSON.stringify({
  severity: 'INFO',
  message: 'Generated password reset link',
  type: 'PASSWORD_RESET',
  email,
  resetUrl,       // ← 移除此行
  timestamp: new Date().toISOString(),
}))

// 修改後
console.log(JSON.stringify({
  severity: 'INFO',
  message: 'Password reset email sent',
  type: 'PASSWORD_RESET',
  emailHash: require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 12),
  timestamp: new Date().toISOString(),
}))
```

---

### AUTH-003｜登入 lockout 可被 username 或 email prefix 觸發

**受影響檔案**
- `packages/forum-cms/utils/login-logging.ts:101-117`

**問題**：lockout counter 記在 display name 或 email prefix 找到的 user，
攻擊者可用部分資訊鎖定任意帳號。

**修正方式**：lockout 只能由精確 email 觸發；alternative fallback lookup 只用於回傳「帳號不存在」等訊息，
不應更新 lockout counter。

```typescript
// packages/forum-cms/utils/login-logging.ts

async function updateLockoutCounter(identity: string, prisma: PrismaClient) {
  // 只用 canonical email 精確查詢，不使用 name 或 email prefix
  const user = await prisma.user.findUnique({
    where: { email: identity.toLowerCase().trim() },
    select: { id: true },
  })
  if (!user) return  // 找不到就不更新，避免 enumeration 副作用

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: { increment: 1 } },
  })
}
```

---

### AUTH-004｜強制改密碼狀態僅靠 client-side redirect

**受影響檔案**
- `packages/forum-cms/keystone.ts:2428-2451`

**修正方式**：在 GraphQL/list operation access hook 中加入 server-side 強制阻擋。

```typescript
// packages/forum-cms/keystone.ts（extendGraphqlSchema 或 session check middleware）

// 在 extendExpressApp 中加入 middleware
app.use('/api/graphql', (req, res, next) => {
  const session = req.session as CmsSession | undefined
  if (session?.data?.mustChangePassword) {
    // 只允許改密碼相關的 mutation 通過，其餘全部拒絕
    const body = req.body as { query?: string } | undefined
    const query = body?.query ?? ''
    const isAllowed =
      query.includes('updateUser') ||
      query.includes('authenticateUserWithPassword') ||
      query.includes('endSession')
    if (!isAllowed) {
      return res.status(403).json({
        errors: [{ message: '請先完成密碼變更才能繼續操作' }],
      })
    }
  }
  next()
})
```

---

### AUTH-005｜會員被 ban 後既有 JWT 到期前仍被接受

**受影響檔案**
- `packages/forum-cms/keystone.ts:393-403`
- `packages/forum-cms/utils/member-session.ts:35-40`

**修正方式**：`verifyMemberSession` 之後，額外查詢 DB 確認 member 狀態。

```typescript
// packages/forum-cms/keystone.ts（currentMember resolver）

async function verifyAndGetActiveMember(token: string, prisma: PrismaClient) {
  const payload = verifyMemberSession(token)  // 驗證 JWT 簽章與到期

  // 每次請求都查 DB 確認 member 仍為有效狀態
  const member = await prisma.member.findUnique({
    where: { id: payload.memberId },
    select: { id: true, state: true },
  })

  if (!member || member.state !== 'active') {
    throw new Error('會員帳號已被停用或刪除')
  }

  return payload
}
```

---

### AUTH-006｜reCAPTCHA 關閉時密碼重設無 server-side throttle

**受影響檔案**
- `packages/forum-cms/utils/login-logging.ts:155-181`

**修正方式**：無論 reCAPTCHA 是否啟用，都加入基於帳號 + IP 的 rate limit。

```typescript
// packages/forum-cms/utils/login-logging.ts（密碼重設路徑）

const passwordResetAttempts = new Map<string, { count: number; resetAt: number }>()
const RESET_WINDOW_MS = 15 * 60 * 1000  // 15 分鐘
const RESET_MAX_ATTEMPTS = 5

function checkPasswordResetRateLimit(key: string): boolean {
  const now = Date.now()
  const record = passwordResetAttempts.get(key)
  if (!record || record.resetAt < now) {
    passwordResetAttempts.set(key, { count: 1, resetAt: now + RESET_WINDOW_MS })
    return true
  }
  if (record.count >= RESET_MAX_ATTEMPTS) return false
  record.count++
  return true
}

// 在 handlePasswordReset 呼叫處
const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown'
const key = `${email}:${ip}`
if (!checkPasswordResetRateLimit(key)) {
  // 回傳通用訊息，不透露是否被 rate limit
  return { success: true }
}
```

> 注意：若服務有多個 replica，建議改用 Redis 儲存 rate limit 計數器以保持一致性。

---

### CONFIG-001｜未設定 CSP、HSTS、clickjacking 防護 header

**受影響檔案**
- `packages/forum-cms/keystone.ts:2328-2344`

**修正方式**：在 `extendExpressApp` 最前面加入 `helmet` middleware。

```bash
yarn workspace forum-cms add helmet
```

```typescript
// packages/forum-cms/keystone.ts（extendExpressApp）

import helmet from 'helmet'

// ...

extendExpressApp: (app, commonContext) => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'nonce-{NONCE}'"],  // nonce 由 Keystone 注入
        styleSrc: ["'self'", "'unsafe-inline'"],   // Admin UI 需要 inline style，待收緊
        imgSrc: ["'self'", 'data:', 'https://storage.googleapis.com'],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
  }))

  // ... 原有 middleware 與 routes
},
```

---

### DEP-001｜Production dependency 含已知漏洞

**修正方式**：升級有漏洞的套件，並在 CI 加入 audit 卡關。

```bash
# 檢查現有 audit
yarn audit --groups dependencies

# 嘗試升級
yarn upgrade protobufjs fast-xml-parser immutable http-proxy-middleware node-forge

# 若無法直接升級（transitive dependency），使用 resolutions（package.json）
```

```json
// packages/forum-cms/package.json
{
  "resolutions": {
    "protobufjs": ">=7.2.5",
    "fast-xml-parser": ">=4.4.1",
    "http-proxy-middleware": ">=2.0.7"
  }
}
```

```yaml
# CI（cloudbuild.yaml 或 GitHub Actions）加入 audit 步驟
- name: node:20
  entrypoint: bash
  args:
    - '-c'
    - |
      yarn audit --groups dependencies --level high
      # exit code 非 0 時建置失敗
```

---

### FILE-001｜keywords.json 公開洩漏審核關鍵字

**受影響檔案**
- `packages/forum-cms/keystone.ts:2458-2467`
- `packages/forum-cms/utils/forbidden-keywords-json.ts:101-111`

**修正方式**：停止把 keywords.json 輸出到 public file storage；改為 server-side only API。

```typescript
// packages/forum-cms/keystone.ts（靜態路由區塊）

// 移除或加入存取控制，避免公開服務 keywords.json
app.get('/files/keywords.json', (req, res) => {
  // 不允許外部存取此路徑
  res.status(404).json({ error: 'Not found' })
})

// 或整體限制 /files 路徑需要 CMS session
app.use('/files', requireCmsSession, express.static(filesStoragePath))
```

```typescript
// packages/forum-cms/utils/forbidden-keywords-json.ts

// 若 keyword 比對需要在 server-side 執行，直接在 hook 中讀取 DB 即可，
// 不需要把資料寫到 public storage
export async function getForbiddenKeywords(context: Context): Promise<string[]> {
  const keywords = await context.sudo().db.ForbiddenKeyword.findMany({
    where: { status: { equals: 'enabled' } },
  })
  return keywords.map((k) => k.keyword)
}
```

---

### FILE-002｜圖片上傳上限允許 2GB buffering

**受影響檔案**
- `packages/forum-cms/lists/image.ts:20-23`
- `packages/forum-cms/keystone.ts:2478-2481`

**修正方式**：降低合理上限，並在 reverse proxy 層也設定限制。

```typescript
// packages/forum-cms/lists/image.ts

storage: {
  // 從 2000MB 降到 10MB（依實際需求調整）
  maxFileSize: 10 * 1024 * 1024,
  ...
},
```

```typescript
// packages/forum-cms/keystone.ts（extendExpressApp）

import multer from 'multer'
// 在 upload route 前加入 size limit middleware
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
```

---

### SC-002｜Dockerfile 匯入未 pin 的 apt trust key

**受影響檔案**
- `packages/forum-cms/Dockerfile:3-18`

**問題**：`curl ... | apt-key add -` 會網路抓取 key 並無條件信任。

**修正方式**：使用 signed-by 方式並固定 key，或換用已包含 gcsfuse 的 base image。

```dockerfile
# 修改前（不安全）
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -

# 修改後
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor \
    | tee /usr/share/keyrings/cloud-google-archive-keyring.gpg > /dev/null \
  && echo "deb [signed-by=/usr/share/keyrings/cloud-google-archive-keyring.gpg] \
    https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list \
  && apt-get update \
  && apt-get install -y gcsfuse=<VERSION>  # pin 到特定版本
```

---

### XSS-001｜Rich-text embedded-code block 在客戶端執行 stored scripts

**受影響檔案**
- `packages/core/src/custom-fields/rich-text-editor/`

**問題**：renderer 從 embedded-code block 建立 `<script>` 並 append 到 DOM。

**修正方式**（若 forum-cms 未來要使用 richTextEditor field）：

1. 限制 embedded-code block 只允許特定白名單 domain 的 embed（如 YouTube iframe）。
2. 改以 sandboxed `<iframe>` 渲染，不直接注入 `<script>`。
3. 配合 CONFIG-001 的 CSP：`script-src` 不包含 `'unsafe-inline'`，讓直接 script injection 無法執行。

---

## 低嚴重度

---

### AUTH-007｜會員註冊洩漏帳號狀態（email/customId 已存在、帳號被 ban）

**受影響檔案**
- `packages/forum-cms/keystone.ts:457-486`

**修正方式**：統一回傳通用錯誤，詳細原因寫進 log（不外露）。

```typescript
// packages/forum-cms/keystone.ts（register resolver）

// 修改前：個別拋出 'Custom ID already exists'、'Email already exists' 等

// 修改後：全部回傳同一個通用訊息
throw new Error('註冊失敗，請確認資料後重試')

// 詳細原因只寫 log（含 email hash，不含明文）
console.log(JSON.stringify({
  severity: 'INFO',
  type: 'REGISTRATION_FAILED',
  reason: actualReason,  // 'duplicate_email' | 'duplicate_custom_id' | 'blocked'
  emailHash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 12),
  timestamp: new Date().toISOString(),
}))
```

---

### XSS-002｜Rich-text link URL 缺少 scheme allowlist

**受影響檔案**
- `node_modules/@mirrormedia/lilith-draft-renderer/`（upstream 套件）

**修正方式**：在 renderer consumer 層加入 URL sanitization（若無法修改 upstream）。

```typescript
// 在 richTextEditor field 的 view 層加入 URL 驗證 helper

function sanitizeLinkUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const allowedSchemes = ['http:', 'https:']
    if (!allowedSchemes.includes(parsed.protocol)) {
      return '#'  // 不安全的 scheme 替換為無動作
    }
    return url
  } catch {
    return '#'
  }
}
```

同時確保所有 `target="_blank"` 的連結加上 `rel="noopener noreferrer"`。

---

### XSS-003｜RECAPTCHA_SITE_KEY 未經 JS escape 就插入 generated Admin UI TSX

**受影響檔案**
- `packages/forum-cms/keystone.ts:1040-1064`

**修正方式**：改用 `JSON.stringify` 做安全嵌入。

```typescript
// packages/forum-cms/keystone.ts（generated TSX 字串）

// 修改前（不安全）
`const RECAPTCHA_SITE_KEY = '${RECAPTCHA_SITE_KEY}';`

// 修改後
`const RECAPTCHA_SITE_KEY = ${JSON.stringify(RECAPTCHA_SITE_KEY)};`
```

並在啟動時驗證 site key 格式（reCAPTCHA site key 格式固定）：

```typescript
if (envVar.recaptcha.enabled) {
  const siteKey = envVar.recaptcha.siteKey
  if (!/^[A-Za-z0-9_-]{20,}$/.test(siteKey)) {
    throw new Error('RECAPTCHA_SITE_KEY 格式不合法')
  }
}
```

---

## 修正優先順序建議

| 優先 | Finding | 原因 |
|------|---------|------|
| P0 | AUTH-001 | 硬編碼 secret 可直接偽造 session，修改簡單且影響高 |
| P0 | AC-006 | 僅在 GraphQL 重新對 public/member client 開放時適用；目前 GQL internal-only 時移出 active findings |
| P0 | AUTH-002 | Reset token 已進 log，需立即確認歷史 log 並輪替 token |
| P1 | AC-010 | Editor 可自行提升權限，一行改動即可修復 |
| P1 | SC-001 | Build pipeline 供應鏈風險，影響所有產出 image |
| P1 | CONFIG-001 | 加入 helmet 一次修復多個 header 問題 |
| P1 | AUTH-005 | Ban 後 JWT 仍有效，會員審核動作效果打折 |
| P2 | AC-002, AC-003, AC-007 | BOLA/ownership 修正，pattern 相似可一起處理 |
| P2 | AC-001, AC-004 | filter.query 補齊，pattern 相似可一起處理 |
| P2 | FILE-001 | 關鍵字資料公開曝光 |
| P3 | 其餘 medium/low | 依資源排程 |
