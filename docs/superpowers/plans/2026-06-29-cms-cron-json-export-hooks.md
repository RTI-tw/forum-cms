# CMS Cron JSON Export Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared CMS afterOperation hooks that proactively request selected cron-services JSON export endpoints after relevant CMS data changes.

**Architecture:** A new `createCronJsonExportHook` helper centralizes cron-services URL handling, timeout fetches, structured logs, and non-blocking error handling. List files declare only endpoint lists and update-field predicates, while `createContentJsonExportHook` remains a compatibility wrapper.

**Tech Stack:** Keystone 6 list hooks, TypeScript, Node.js built-in `assert`, existing `fetchWithTimeout`, existing `CRON_SERVICES_URL` and `MESSAGE_SERVICES_HOOK_TIMEOUT_MS` environment configuration.

---

## File Structure

- Create `packages/forum-cms/utils/cron-json-export-hook.ts`: generic hook factory, endpoint constants, field predicate helpers.
- Create `packages/forum-cms/utils/cron-json-export-hook.test.ts`: focused unit coverage for shared helper behavior.
- Modify `packages/forum-cms/utils/content-json-export-hook.ts`: wrap the shared helper for `/export/contents-to-gcs`.
- Modify `packages/forum-cms/utils/content-json-export-hook.test.ts`: keep existing public behavior test passing.
- Modify `packages/forum-cms/lists/editor-choice.ts`: attach home editor-choice export hook.
- Modify `packages/forum-cms/lists/Post.ts`: attach home editor-choice and curated latest/polls export hook after existing post side effects.
- Modify `packages/forum-cms/lists/ad.ts`: attach ads export hook.
- Modify `packages/forum-cms/lists/ad-slide.ts`: attach ads export hook.

## Task 1: Shared Cron Export Hook

**Files:**
- Create: `packages/forum-cms/utils/cron-json-export-hook.ts`
- Test: `packages/forum-cms/utils/cron-json-export-hook.test.ts`

- [ ] **Step 1: Write failing helper tests**

```ts
import assert from 'assert'

process.env.CRON_SERVICES_URL = 'https://cron-services.example.test/'
process.env.MESSAGE_SERVICES_URL = 'https://message-services.example.test'
process.env.MESSAGE_SERVICES_HOOK_TIMEOUT_MS = '1000'

async function main() {
  const originalFetch = global.fetch
  const calls: Array<{ url: string; method?: string }> = []

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method })
    return { ok: true, status: 200, text: async () => '' } as Response
  }) as typeof fetch

  try {
    const {
      createCronJsonExportHook,
      hasAnyResolvedField,
    } = require('./cron-json-export-hook')

    const hook = createCronJsonExportHook({
      label: 'test export',
      endpoints: ['/export/a', '/export/b'],
      shouldTrigger: ({ operation, resolvedData }: any) =>
        operation !== 'update' ||
        hasAnyResolvedField(resolvedData, ['title']),
    })

    await hook({ operation: 'create', resolvedData: {} })
    await hook({ operation: 'update', resolvedData: { title: 'changed' } })
    await hook({ operation: 'update', resolvedData: { updatedAt: new Date() } })
    await hook({ operation: 'delete', resolvedData: {} })
    await hook({ operation: 'query', resolvedData: {} })

    assert.deepEqual(calls, [
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
    ])
  } finally {
    global.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/forum-cms && npx ts-node --compiler-options '{"module":"commonjs"}' utils/cron-json-export-hook.test.ts`

Expected: FAIL because `./cron-json-export-hook` does not exist.

- [ ] **Step 3: Implement the helper**

Create `packages/forum-cms/utils/cron-json-export-hook.ts` with:

```ts
import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'
import { fetchWithTimeout } from './fetch-with-timeout'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

type HookArgs = Parameters<AfterOperationHookFn>[0] & {
  resolvedData?: Record<string, unknown>
}

type CronJsonExportHookConfig = {
  label: string
  endpoints: string[]
  shouldTrigger?: (args: HookArgs) => boolean
}

let warnedMissingCronServicesUrl = false

export function hasAnyResolvedField(
  resolvedData: Record<string, unknown> | undefined,
  fields: readonly string[]
) {
  if (!resolvedData) return false
  return fields.some((field) =>
    Object.prototype.hasOwnProperty.call(resolvedData, field)
  )
}

function warnMissingCronServicesUrlOnce() {
  if (warnedMissingCronServicesUrl) return
  warnedMissingCronServicesUrl = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message: 'CRON_SERVICES_URL 未設定，JSON export hook 不會呼叫 cron-services。',
      timestamp: new Date().toISOString(),
    })
  )
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
}

export function createCronJsonExportHook({
  label,
  endpoints,
  shouldTrigger,
}: CronJsonExportHookConfig): AfterOperationHookFn {
  return async (args) => {
    const operation = args.operation
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
      return
    }
    if (shouldTrigger && !shouldTrigger(args as HookArgs)) {
      return
    }

    const baseUrl = envVar.cronServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) {
      warnMissingCronServicesUrlOnce()
      return
    }

    for (const endpoint of endpoints) {
      const normalizedEndpoint = normalizeEndpoint(endpoint)
      try {
        const exportRes = await fetchWithTimeout(
          `${baseUrl}${normalizedEndpoint}`,
          { method: 'GET' },
          envVar.messageServices.hookTimeoutMs,
          `cron-services ${normalizedEndpoint.replace(/^\//, '')} timed out after ${envVar.messageServices.hookTimeoutMs}ms`
        )

        if (!exportRes.ok) {
          const detail = await exportRes.text()
          console.error(
            JSON.stringify({
              severity: 'ERROR',
              message: `cron-services ${normalizedEndpoint} failed`,
              label,
              endpoint: normalizedEndpoint,
              status: exportRes.status,
              operation,
              detail: detail.slice(0, 2000),
              timestamp: new Date().toISOString(),
            })
          )
          continue
        }

        console.info(
          JSON.stringify({
            severity: 'INFO',
            message: `cron-services ${normalizedEndpoint} 已請求`,
            label,
            endpoint: normalizedEndpoint,
            status: exportRes.status,
            operation,
            bucket: envVar.gcs.bucket,
            timestamp: new Date().toISOString(),
          })
        )
      } catch (error) {
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: `cron-services ${normalizedEndpoint} request failed`,
            label,
            endpoint: normalizedEndpoint,
            operation,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          })
        )
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/forum-cms && npx ts-node --compiler-options '{"module":"commonjs"}' utils/cron-json-export-hook.test.ts`

Expected: PASS with exit code 0.

## Task 2: Content Wrapper Compatibility

**Files:**
- Modify: `packages/forum-cms/utils/content-json-export-hook.ts`
- Test: `packages/forum-cms/utils/content-json-export-hook.test.ts`

- [ ] **Step 1: Run existing content hook test before changing wrapper**

Run: `cd packages/forum-cms && npx ts-node --compiler-options '{"module":"commonjs"}' utils/content-json-export-hook.test.ts`

Expected: PASS before refactor, proving the current behavior.

- [ ] **Step 2: Replace duplicated implementation with wrapper**

Update `content-json-export-hook.ts` to:

```ts
import type { ListHooks } from '@keystone-6/core/types'
import { createCronJsonExportHook } from './cron-json-export-hook'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

export function createContentJsonExportHook(): AfterOperationHookFn {
  return createCronJsonExportHook({
    label: 'content json export',
    endpoints: ['/export/contents-to-gcs'],
  })
}
```

- [ ] **Step 3: Run compatibility test**

Run: `cd packages/forum-cms && npx ts-node --compiler-options '{"module":"commonjs"}' utils/content-json-export-hook.test.ts`

Expected: PASS and still calls `https://cron-services.example.test/export/contents-to-gcs` with `GET`.

## Task 3: List Hook Integration

**Files:**
- Modify: `packages/forum-cms/lists/editor-choice.ts`
- Modify: `packages/forum-cms/lists/Post.ts`
- Modify: `packages/forum-cms/lists/ad.ts`
- Modify: `packages/forum-cms/lists/ad-slide.ts`

- [ ] **Step 1: Export field lists and hook instances near each list**

Use `hasAnyResolvedField` and `createCronJsonExportHook` from `../utils/cron-json-export-hook`.

For `editor-choice.ts`:

```ts
const editorChoiceExportAfterOperation = createCronJsonExportHook({
  label: 'home editor choices json export',
  endpoints: ['/export/home-editor-choices-to-gcs'],
  shouldTrigger: ({ operation, resolvedData }) =>
    operation !== 'update' ||
    hasAnyResolvedField(resolvedData, ['post', 'sortOrder', 'state']),
})
```

For `Post.ts`:

```ts
const postJsonExportAfterOperation = createCronJsonExportHook({
  label: 'post json exports',
  endpoints: [
    '/export/home-editor-choices-to-gcs',
    '/export/curated-posts-latest-polls-to-gcs',
  ],
  shouldTrigger: ({ operation, resolvedData }) =>
    operation !== 'update' ||
    hasAnyResolvedField(resolvedData, [
      'status',
      'published_date',
      'isEditorChoice',
      'isLifeGuide',
      'isRtiChoice',
      'isBoost',
      'title',
      'title_zh',
      'title_en',
      'title_vi',
      'title_id',
      'title_th',
      'content',
      'heroImages',
      'author',
      'poll',
      'commentsCount',
      'reactionsCount',
    ]),
})
```

For `ad.ts`:

```ts
const adJsonExportAfterOperation = createCronJsonExportHook({
  label: 'ads json export',
  endpoints: ['/export/ads-to-gcs'],
  shouldTrigger: ({ operation, resolvedData }) =>
    operation !== 'update' ||
    hasAnyResolvedField(resolvedData, [
      'title',
      'format',
      'status',
      'startAt',
      'endAt',
      'image',
      'mobileImage',
      'slides',
      'videoUrl',
      'videoFile',
      'adCode',
      'linkUrl',
    ]),
})
```

For `ad-slide.ts`:

```ts
const adSlideJsonExportAfterOperation = createCronJsonExportHook({
  label: 'ad slide json export',
  endpoints: ['/export/ads-to-gcs'],
  shouldTrigger: ({ operation, resolvedData }) =>
    operation !== 'update' ||
    hasAnyResolvedField(resolvedData, [
      'ad',
      'image',
      'mobileImage',
      'linkUrl',
      'sortOrder',
    ]),
})
```

- [ ] **Step 2: Attach each hook after existing side effects**

For `EditorChoice`, add:

```ts
afterOperation: editorChoiceExportAfterOperation,
```

For `Post.afterOperation`, append:

```ts
await postJsonExportAfterOperation(args)
```

after `syncEditorChoiceStateForPostId`.

For `Ad`, add:

```ts
afterOperation: adJsonExportAfterOperation,
```

For `AdSlide`, keep `validateInput` and add:

```ts
afterOperation: adSlideJsonExportAfterOperation,
```

- [ ] **Step 3: Run TypeScript and focused hook tests**

Run:

```bash
cd packages/forum-cms
npx ts-node --compiler-options '{"module":"commonjs"}' utils/cron-json-export-hook.test.ts
npx ts-node --compiler-options '{"module":"commonjs"}' utils/content-json-export-hook.test.ts
npx tsc --noEmit
```

Expected: both hook tests exit 0; TypeScript exits 0.

## Task 4: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd packages/forum-cms
npx ts-node --compiler-options '{"module":"commonjs"}' utils/cron-json-export-hook.test.ts
npx ts-node --compiler-options '{"module":"commonjs"}' utils/content-json-export-hook.test.ts
```

Expected: exit code 0.

- [ ] **Step 2: Run package typecheck**

Run: `cd packages/forum-cms && npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Review diff**

Run: `git diff -- packages/forum-cms/utils packages/forum-cms/lists docs/superpowers`

Expected: diff contains only shared hook, hook tests, wrapper refactor, list hook wiring, and docs for this feature.
