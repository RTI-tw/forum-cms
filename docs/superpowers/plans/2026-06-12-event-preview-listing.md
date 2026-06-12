# Event Preview Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CMS-managed event labels/notices and expose grouped frontend event preview data.

**Architecture:** Store durable CMS metadata on `Event`; keep title/images/status on related `Post`; compute frontend preview sections, registration counts, member registration state, and CTA availability in the existing event registration GraphQL extension. The computed availability status is event-level, while `isRegistered` is member-specific.

**Tech Stack:** Keystone 6 lists, Prisma schema/migrations, custom Keystone GraphQL extension, Node `node:test`/`assert` tests.

---

### File Structure

- Modify `packages/forum-cms/lists/event.ts`: add `label` select and `notice` markdown text field; add fields to CMS initial columns.
- Modify `packages/forum-cms/schema.prisma`: add `EventLabelType` enum and `Event.label` / `Event.notice` columns.
- Modify `packages/forum-cms/schema.graphql`: reflect generated Keystone schema plus custom query/result types.
- Create `packages/forum-cms/migrations/20260612120000_event_label_notice_preview/migration.sql`: add DB enum and columns.
- Modify `packages/forum-cms/utils/event-registration-gql.ts`: add preview types, helpers, and `eventPreviews` query.
- Modify `packages/forum-cms/lists/event-registration-lists.test.ts`: add failing coverage for list/schema/query registration.
- Create `packages/forum-cms/utils/event-preview-status.test.ts`: focused unit tests for computed status helpers.

### Task 1: Add Failing List And Schema Tests

**Files:**
- Modify: `packages/forum-cms/lists/event-registration-lists.test.ts`

- [ ] Add assertions that `Event` has `label` and `notice`, Prisma includes `EventLabelType`, GraphQL includes `eventPreviews`, `label`, and `notice`.
- [ ] Run: `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node packages/forum-cms/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' packages/forum-cms/lists/event-registration-lists.test.ts`
- [ ] Expected: FAIL because `label`, `notice`, enum, and `eventPreviews` do not exist yet.

### Task 2: Add Failing Status Unit Tests

**Files:**
- Create: `packages/forum-cms/utils/event-preview-status.test.ts`

- [ ] Add tests for:
  - `registrationEndAt` in the past returns `closed`.
  - Full active registrations return `full`.
  - Future `registrationStartAt` returns `notStarted`.
  - Active registered member produces `isRegistered: true` without changing event status.
- [ ] Run: `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node packages/forum-cms/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' packages/forum-cms/utils/event-preview-status.test.ts`
- [ ] Expected: FAIL because status helpers are not exported yet.

### Task 3: Implement CMS Fields And Schemas

**Files:**
- Modify: `packages/forum-cms/lists/event.ts`
- Modify: `packages/forum-cms/schema.prisma`
- Modify: `packages/forum-cms/schema.graphql`
- Create: `packages/forum-cms/migrations/20260612120000_event_label_notice_preview/migration.sql`

- [ ] Add `select` import and `label` select field to `Event`.
- [ ] Add `notice` text field with `views: './lists/views/markdown-editor/index'`, `displayMode: 'textarea'`, and `validation.length.max: 100`.
- [ ] Add `label` and `notice` to Event list initial columns.
- [ ] Add Prisma enum/columns and matching GraphQL enum/filter/order/input/type fields.
- [ ] Add SQL migration creating enum `EventLabelType`, adding `"label"` with default `'more'`, and adding `"notice" TEXT NOT NULL DEFAULT ''`.
- [ ] Run list/schema tests again.

### Task 4: Implement Preview Query

**Files:**
- Modify: `packages/forum-cms/utils/event-registration-gql.ts`
- Modify: `packages/forum-cms/schema.graphql`

- [ ] Extend event record types with `label` and `notice`.
- [ ] Export `getEventPreviewAvailabilityStatus` and `buildEventPreviewItem` helpers.
- [ ] Add GraphQL result types `EventPreviewImageResult`, `EventPreviewItemResult`, and `EventPreviewSectionsResult`.
- [ ] Add query `eventPreviews`.
- [ ] Query published events, order by `startAt desc`, include `post.heroImages`, count active registrations, and check current member active registrations when bearer token is present.
- [ ] Run status tests and list/schema tests.

### Task 5: Final Verification

**Files:**
- All modified files.

- [ ] Run focused tests with `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node packages/forum-cms/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' packages/forum-cms/lists/event-registration-lists.test.ts`, `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node packages/forum-cms/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' packages/forum-cms/utils/event-preview-status.test.ts`, and `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node packages/forum-cms/node_modules/ts-node/dist/bin.js --compiler-options '{"module":"CommonJS"}' packages/forum-cms/utils/event-registration-form.test.ts`.
- [ ] Run QR token tests with `/Users/hcchien/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node -e "globalThis.test = require('node:test').test; require('./packages/forum-cms/node_modules/ts-node').register({ compilerOptions: { module: 'CommonJS' } }); require('./packages/forum-cms/utils/event-qr-token.test.ts')"`.
- [ ] Run `git diff --check`.
- [ ] Review changed files for unrelated edits.
