# Event Preview Listing Design

## Goal

Add CMS-managed event grouping and notice content, then expose a frontend-ready event preview query grouped into "熱門活動", "更多活動", and "活動回顧".

## Current Context

- `Event` stores event-specific metadata in `packages/forum-cms/lists/event.ts`.
- Event title, body, publication status, and hero images are stored on the related `Post`.
- Public event registration GraphQL lives in `packages/forum-cms/utils/event-registration-gql.ts`.
- Active registrations are `EventRegistration.status` values `registered` and `checkedIn`.

## CMS Fields

`Event` gets two new metadata fields:

- `label`: required enum select with values:
  - `hot`: `熱門活動`
  - `more`: `更多活動`
  - `past`: `活動回顧`
- `notice`: text field rendered with the existing markdown editor custom view. It supports WYSIWYG-style preview and has a 100-character validation limit.

Existing events default to `more`, because that is the neutral general-purpose section.

## Public Query

Add a custom GraphQL query in `event-registration-gql.ts` named `eventPreviews`.

The query returns three grouped sections:

- `hot`
- `more`
- `past`

Each section contains only events whose related `Post.status` is `published`, sorted by `Event.startAt DESC`.

Each preview item includes:

- Event id and slug.
- Event `label`.
- Related post title.
- First related post hero image data, plus the existing image list shape if useful to consumers.
- Event start/end time.
- Registration start/end time.
- Active registration count.
- Capacity and remaining capacity.
- Event notice markdown.
- Computed availability status.
- `isRegistered` for the current member when a valid member bearer token is present.

## Status Semantics

Event availability status is independent of whether the current member is registered.

- `closed`: activity `endAt` has passed, or `registrationEndAt` has passed.
- `full`: event is not closed and capacity is set and active registration count is greater than or equal to capacity.
- `open`: event is not closed, registration has started if `registrationStartAt` is set, and the event is not full.
- `notStarted`: event is not closed, but `registrationStartAt` is still in the future.

`已報名` is not an event status. The query returns `isRegistered` separately, and frontend CTA copy can prefer that flag over availability status.

## Validation And Safety

- `notice` max length is enforced by Keystone text validation.
- `label` is required and constrained by enum values.
- The public query only exposes published events through the related `Post.status`.
- Member-specific `isRegistered` is optional: unauthenticated requests should still return preview sections with `isRegistered: false`.

## Testing

Add tests covering:

- `Event` exposes `label` and `notice`.
- Prisma and GraphQL schemas include the new event fields and enum.
- The public GraphQL result type and query are registered.
- Status calculation keeps `isRegistered` separate from event availability and uses `registrationEndAt`.
