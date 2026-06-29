# CMS Cron JSON Export Hooks Design

## Goal

CMS list hooks should proactively request selected cron-services JSON exports after CMS data changes, so the existing cronjobs can run less frequently while public JSON files update closer to the write event.

## Scope

This change applies only to CMS-triggered requests to existing cron-services endpoints:

- `/export/home-editor-choices-to-gcs`
- `/export/curated-posts-latest-polls-to-gcs`
- `/export/ads-to-gcs`
- Existing `/export/contents-to-gcs` behavior remains supported through the same shared helper.

No cron-services endpoint behavior, GCS object shape, scheduler configuration, or export payload format changes are included.

## Architecture

Add a shared CMS helper, `createCronJsonExportHook`, for Keystone `afterOperation` hooks. The helper owns common export behavior:

- Skip unsupported operations.
- Trigger on every `create` and `delete`.
- For `update`, call a caller-provided predicate that checks whether `resolvedData` includes fields relevant to the export.
- Read `CRON_SERVICES_URL` from existing environment configuration.
- Request one or more cron-services endpoints with `GET`.
- Use the existing hook timeout setting and `fetchWithTimeout`.
- Log success and failure as structured JSON.
- Never throw export request failures back to Keystone, preserving current non-blocking CMS write behavior.

The existing `createContentJsonExportHook` becomes a thin wrapper around the shared helper to preserve its public API and current Content list integration.

## Trigger Rules

### EditorChoice

`EditorChoice` changes affect `editor-choices.json`.

- `create`: request `/export/home-editor-choices-to-gcs`
- `delete`: request `/export/home-editor-choices-to-gcs`
- `update`: request `/export/home-editor-choices-to-gcs` when `resolvedData` includes `post`, `sortOrder`, or `state`

### Post

`Post` changes can affect both the homepage editor-choice export and curated latest/polls exports.

The hook runs after the existing translation hook, spam-score status adjustment, and `EditorChoice` state sync so exports observe the final persisted state.

- `create`: request `/export/home-editor-choices-to-gcs` and `/export/curated-posts-latest-polls-to-gcs`
- `delete`: request `/export/home-editor-choices-to-gcs` and `/export/curated-posts-latest-polls-to-gcs`
- `update`: request both endpoints when `resolvedData` includes one of:
  - `status`
  - `published_date`
  - `isEditorChoice`
  - `isLifeGuide`
  - `isRtiChoice`
  - `isBoost`
  - `title`
  - `title_zh`
  - `title_en`
  - `title_vi`
  - `title_id`
  - `title_th`
  - `content`
  - `heroImages`
  - `author`
  - `poll`
  - `commentsCount`
  - `reactionsCount`

### Ad

`Ad` changes affect `ads.json`.

- `create`: request `/export/ads-to-gcs`
- `delete`: request `/export/ads-to-gcs`
- `update`: request `/export/ads-to-gcs` when `resolvedData` includes one of:
  - `title`
  - `format`
  - `status`
  - `startAt`
  - `endAt`
  - `image`
  - `mobileImage`
  - `slides`
  - `videoUrl`
  - `videoFile`
  - `adCode`
  - `linkUrl`

### AdSlide

`AdSlide` changes affect `ads.json`.

- `create`: request `/export/ads-to-gcs`
- `delete`: request `/export/ads-to-gcs`
- `update`: request `/export/ads-to-gcs` when `resolvedData` includes one of:
  - `ad`
  - `image`
  - `mobileImage`
  - `linkUrl`
  - `sortOrder`

## Error Handling

Missing `CRON_SERVICES_URL` logs a warning once per process and skips export requests.

Non-2xx cron-services responses log endpoint, status, operation, and truncated response body. Network failures and timeouts log endpoint, operation, and error message. All failures are swallowed so CMS create, update, and delete operations are not blocked by export availability.

## Testing

Add focused tests for the shared helper:

- `create` calls all configured endpoints.
- `delete` calls all configured endpoints.
- `update` calls endpoints only when the predicate returns true.
- `update` skips endpoints when the predicate returns false.
- Multiple endpoints are requested in order.
- Missing `CRON_SERVICES_URL` skips network calls.
- Non-2xx and thrown fetch errors are logged and swallowed.

Update the existing content export hook test to verify it still requests `/export/contents-to-gcs`.

Add list-level smoke tests by importing each list source and checking the relevant hook factory constants or exported predicates where feasible. If list internals are not exposed cleanly, cover trigger predicates through exported utility functions rather than brittle source-text checks.

## Open Decisions

None. The selected approach is the shared helper with per-list trigger predicates.
