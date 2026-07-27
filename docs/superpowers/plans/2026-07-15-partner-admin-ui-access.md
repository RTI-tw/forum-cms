# Partner Admin UI Access Implementation Plan

> **For agentic workers:** Implement this plan task-by-task and keep the checkboxes updated. Security-sensitive access-control work must be reviewed and tested before deployment.

**Goal:** Allow an admin-managed `partner` CMS user to use the existing Keystone Admin UI while restricting that user to the posts, comments, polls, events, and registrations owned by the linked frontend Member account.

**Architecture:** Keep `ACCESS_CONTROL_STRATEGY=cms` and add `partner` as a CMS role rather than as a deployment-wide access strategy. Add an explicit one-to-one partner Member link on `User`. Centralize partner identity and ownership helpers, enforce authorization in Keystone operation/filter/item/field access plus hooks, and use session-aware Admin UI configuration only as a presentation layer. Partner authorization must not rely on hidden navigation or hidden fields.

**Tech Stack:** Keystone 6 Admin UI and list access control, TypeScript, Prisma/PostgreSQL migrations, GraphQL schema generation, Node assert tests through `ts-node`.

---

## Security Invariants

1. A partner must never choose or submit an arbitrary owner Member id. Ownership is derived from the authenticated CMS User's configured Member relation.
2. A partner query must include an ownership filter at the database query layer. Filtering results after fetching is not acceptable.
3. UI visibility is not authorization. Every hidden list, field, create button, and delete button must have corresponding server-side access enforcement.
4. Partner create/update hooks must reject or remove forbidden input, including input sent directly to GraphQL outside the Admin UI.
5. Relationship inputs must be validated on the server so a partner cannot connect another partner's Post, Poll, PollOption, or Event by id.
6. `context.sudo()` may be used to resolve identity or validate ownership, but never to perform an unvalidated partner-requested mutation.
7. Missing, inactive, deleted, or ambiguous Member linkage fails closed.
8. Existing `admin` and `editor` behavior must remain unchanged unless explicitly listed in this plan.

## Product Decisions Required Before Implementation

- [ ] Confirm whether one frontend Member may be linked to more than one partner CMS User. This plan assumes **no** and uses a one-to-one relation.
- [ ] Confirm whether "可建立且編輯留言翻譯內容" means creating a new Comment row in CMS or filling/editing translation fields on existing comments. This plan defaults to **translation fields on existing comments only**, because CMS currently explicitly prohibits creating comments.
- [ ] Confirm whether partners may delete their Posts, Polls, PollOptions, or Events. This plan defaults to **no partner delete operations**.
- [ ] Confirm whether partners may change Post publication status. This plan defaults to allowing `draft`, `pending`, and `published`, while denying moderation-only statuses (`reject`, `hidden`, `archived`) until product approval.
- [ ] Confirm whether the hidden Photo/Video lists still permit inline upload/selection from a partner Post. This plan defaults to **no Photo/Video access**, including relationship changes.
- [ ] Confirm whether Event ownership should remain fixed when its related Post changes. This plan assumes Event has a dedicated creator Member and ownership does not change implicitly.

Do not begin authorization implementation until these decisions are recorded in this document or an accompanying specification.

---

## File Map

### Expected new files

- `packages/forum-cms/utils/partner-access.ts`: partner role, linked Member resolution, ownership filters, and relationship validation helpers.
- `packages/forum-cms/utils/partner-access.test.ts`: focused identity, fail-closed, and filter tests.
- `packages/forum-cms/lists/partnerAccess.test.ts`: list access/UI/hook regression tests covering all partner-visible lists.
- `packages/forum-cms/migrations/<timestamp>_add_partner_member_and_event_creator/migration.sql`: database changes and indexes.

### Expected modified files

- `packages/forum-cms/keystone.ts`: include partner Member linkage data needed by session-aware Admin UI where appropriate; preserve runtime database verification.
- `packages/forum-cms/lists/user.ts`: add `partner` role and the admin-managed Member relation.
- `packages/forum-cms/lists/Post.ts`: ownership filters, create defaults, forbidden fields, relationship validation, and partner field UI.
- `packages/forum-cms/lists/comment.ts`: parent Post ownership filter and translation-only update enforcement.
- `packages/forum-cms/lists/poll.ts`: owner defaults/filter, partner create/update rules, and relationship validation.
- `packages/forum-cms/lists/poll-option.ts`: parent Poll ownership filters and update rules.
- `packages/forum-cms/lists/poll-vote.ts`: parent Poll ownership query filter and read-only partner operations.
- `packages/forum-cms/lists/event.ts`: creator relation/default, ownership filters, and own-Post relationship validation.
- `packages/forum-cms/lists/event-registration.ts`: parent Event ownership query filter and partner operation restrictions.
- `packages/forum-cms/lists/index.ts` and all partner-hidden list files, or a shared list UI helper: session-aware navigation visibility and operation denial.
- `packages/forum-cms/utils/event-registration-gql.ts`: explicitly preserve check-in access for authenticated partner CMS users and add role tests.
- `packages/forum-cms/schema.prisma`: add User-to-Member and Event-to-Member ownership columns/relations.
- `packages/forum-cms/schema.graphql`: regenerate after list/schema changes.
- `packages/forum-cms/README.md`: document partner configuration, access behavior, and deployment requirements.

The exact migration timestamp and generated schema changes must be produced during implementation, not manually guessed in advance.

---

## Task 1: Characterization And Threat-Model Tests

**Files:**
- Create: `packages/forum-cms/utils/partner-access.test.ts`
- Create: `packages/forum-cms/lists/partnerAccess.test.ts`
- Read/extend existing tests near each affected list.

- [ ] Write a role matrix covering anonymous/member API, partner CMS session, editor CMS session, and admin CMS session.
- [ ] Add failing tests proving a partner cannot query another Member's Post, Comment, Poll, PollOption, PollVote, Event, or EventRegistration.
- [ ] Add failing tests proving direct GraphQL mutation input cannot set another Member as Post author, Poll owner, or Event creator.
- [ ] Add failing tests proving a partner cannot set moderation flags or connect another owner's relationships.
- [ ] Add regression tests for current admin/editor behavior.
- [ ] Add a test proving missing or invalid partner Member linkage denies all partner content access.
- [ ] Run the focused tests and record the expected failures before implementation.

## Task 2: Partner Identity Data Model

**Files:**
- Modify: `packages/forum-cms/lists/user.ts`
- Modify: `packages/forum-cms/lists/member.ts`
- Modify: `packages/forum-cms/schema.prisma`
- Create: migration SQL.

- [ ] Add `{ label: 'Partner', value: 'partner' }` to `User.role`.
- [ ] Add an admin-managed to-one `User.partnerMember` relation with a clear Chinese label and description.
- [ ] Add the reverse Member relation only if needed for Keystone relation integrity or admin discoverability.
- [ ] Enforce the agreed uniqueness rule at the database level where possible.
- [ ] Add validation: `role=partner` requires a linked active Member; non-partner roles must not accidentally inherit partner authorization.
- [ ] Ensure only admin can create/update User role and partner linkage; a partner cannot relink itself.
- [ ] Add indexed ownership columns for Event creator and other new foreign keys.
- [ ] Generate and review the Prisma migration, including safe handling of existing User/Event rows.

## Task 3: Central Partner Access Helpers

**Files:**
- Create: `packages/forum-cms/utils/partner-access.ts`
- Test: `packages/forum-cms/utils/partner-access.test.ts`

- [ ] Add `isPartnerSession(context)` and access-argument equivalents.
- [ ] Add `getPartnerMemberId(context)` that resolves the authenticated User relation and fails closed.
- [ ] Add reusable ownership filters for direct Member ownership and nested parent ownership.
- [ ] Add helpers to validate `connect`, `disconnect`, and nested relationship inputs.
- [ ] Keep `ACCESS_CONTROL_STRATEGY=api` behavior isolated from CMS partner authorization; partner helpers must apply only to authenticated CMS sessions.
- [ ] Avoid broad boolean `true` returns for partner queries when an ownership filter is required.
- [ ] Test numeric/string id normalization and malformed input.

## Task 4: Admin UI Visibility And Entry Control

**Files:**
- Modify affected list UI configurations and shared UI helper(s).
- Modify Admin UI configuration under `packages/forum-cms/admin` if required.

- [ ] Keep Partner users able to authenticate into the existing Admin UI.
- [ ] Hide the following lists from partner navigation: Report, User, Member, OfficialMapping, Topic, EditorChoice, Reaction, Bookmark, Content, ForbiddenKeyword, Video, Photo, Ad, AdSlide, HomepageImage, RssKeyword, and RssTopicMapping.
- [ ] Keep only Post, Comment, Poll, PollOption, PollVote, Event, and EventRegistration visible to partner users.
- [ ] Hide create/delete controls where partner mutations are not allowed.
- [ ] Add server-side operation denial for every hidden list; verify direct GraphQL access fails.
- [ ] Confirm session-aware UI callbacks receive `role=partner` from `sessionData`.

## Task 5: Post Ownership And Field Restrictions

**Files:**
- Modify: `packages/forum-cms/lists/Post.ts`
- Extend focused Post tests.

- [ ] Partner query/update filters must constrain `author.id` to the linked Member id.
- [ ] On create, ignore/reject explicit `author` input and force author to the linked Member.
- [ ] On update, prevent author reassignment.
- [ ] Hide and reject `isEditorChoice`, `isLifeGuide`, `isRtiChoice`, and `isBoost` for partner create/update.
- [ ] Apply the agreed status whitelist and deny moderation-only transitions.
- [ ] Permit original and translation title/content fields as required.
- [ ] Validate every connected Poll and Event belongs to the partner.
- [ ] Apply the confirmed Photo/Video policy consistently in UI and hooks.
- [ ] Ensure bulk update/delete operations cannot bypass item ownership.

## Task 6: Comment Access And Translation Rules

**Files:**
- Modify: `packages/forum-cms/lists/comment.ts`
- Extend Comment moderation tests.

- [ ] Partner query filter must constrain `post.author.id` to the linked Member id.
- [ ] Allow partner updates only for `content_zh`, `content_en`, `content_vi`, `content_id`, `content_th`, and any explicitly approved translation-control fields.
- [ ] Reject changes to Comment author, parent Post, original content, status, counters, reports, IP, and moderation data unless product explicitly approves them.
- [ ] If new Comment creation is approved, require an owned Post, force the linked Member as author, and define status/original-language behavior explicitly.
- [ ] Otherwise preserve the current CMS Comment-create prohibition and ensure the UI create button is hidden.

## Task 7: Poll, PollOption, And PollVote

**Files:**
- Modify: `packages/forum-cms/lists/poll.ts`
- Modify: `packages/forum-cms/lists/poll-option.ts`
- Modify: `packages/forum-cms/lists/poll-vote.ts`
- Extend Poll tests.

- [ ] Poll query/update filters must constrain `member.id` to the linked Member.
- [ ] Poll create must force `member` to the linked Member and support `maxSelections >= 1`.
- [ ] Permit Poll original and translation fields according to the approved field matrix; do not reuse the current global translation-only hook without role-aware branching.
- [ ] Poll may connect only an owned Post.
- [ ] PollOption access must be constrained through `poll.member.id`.
- [ ] PollOption create must connect only an owned Poll; update must not move an option to another Poll.
- [ ] PollVote partner access must be read-only and constrained through `poll.member.id`.
- [ ] Keep aggregate counts server-managed and read-only.

## Task 8: Event And EventRegistration

**Files:**
- Modify: `packages/forum-cms/lists/event.ts`
- Modify: `packages/forum-cms/lists/event-registration.ts`
- Modify: `packages/forum-cms/utils/event-registration-gql.ts`
- Extend event registration/check-in tests.

- [ ] Add an Event creator Member relation and force it from the authenticated partner on create.
- [ ] Partner Event queries/updates must filter by creator Member.
- [ ] Event create/update may connect only a Post whose author is the linked Member.
- [ ] Prevent partner creator reassignment and cross-owner Post replacement.
- [ ] EventRegistration partner query must constrain `event.creator.id` to the linked Member.
- [ ] Keep EventRegistration mutation fields server-managed unless explicitly approved.
- [ ] Preserve `previewEventCheckInToken` and `confirmEventCheckIn` for authenticated partner CMS sessions across all events.
- [ ] Confirm check-in does not grant general access to another owner's EventRegistration list or personal data beyond the minimum scan result.
- [ ] Add audit fields/logging for partner check-in actions if existing `checkedInBy` is insufficient for operational review.

## Task 9: Generated Schemas And Migration Verification

**Files:**
- Modify generated `schema.prisma` and `schema.graphql` through Keystone tooling.
- Create/review migration SQL.

- [ ] Run Keystone schema generation.
- [ ] Review generated GraphQL inputs to ensure forbidden fields are still protected by access/hooks even if present in schema.
- [ ] Apply the migration to an empty local database.
- [ ] Apply the migration to a representative copy containing existing Users, Members, Posts, Polls, and Events.
- [ ] Verify rollback/recovery instructions and backup requirements.

## Task 10: Security And Regression Verification

- [ ] Run focused partner access tests.
- [ ] Run all existing forum-cms tests.
- [ ] Run TypeScript checking and Keystone build.
- [ ] Test Admin UI manually as admin, editor, and partner.
- [ ] Test direct GraphQL queries and mutations outside the Admin UI for horizontal privilege escalation.
- [ ] Test guessed ids, nested connects, bulk mutations, relationship selectors, and stale sessions.
- [ ] Verify a disabled/deleted linked Member immediately loses partner content access.
- [ ] Verify partner cannot enumerate hidden lists through Admin UI and cannot operate them through GraphQL.
- [ ] Verify admin can still configure partner role/linkage and manage all content.
- [ ] Record security test evidence in the PR description.

## Task 11: Documentation And Rollout

**Files:**
- Modify: `packages/forum-cms/README.md`

- [ ] Document how an admin creates a partner User and links the Member account.
- [ ] Document the exact partner-visible lists, allowed fields, and ownership rules.
- [ ] Document that the deployment remains `ACCESS_CONTROL_STRATEGY=cms`; do not configure `api` or a new `partner` strategy for Admin UI users.
- [ ] Deploy migration before enabling partner accounts.
- [ ] Create one staging partner per ownership scenario and complete UAT.
- [ ] Monitor authorization failures and partner mutations after rollout.
- [ ] Provide an emergency disable procedure: remove partner role/linkage or disable partner login without reverting the migration.

---

## Definition Of Done

- [ ] Admin can assign `partner` and link exactly one valid frontend Member.
- [ ] Partner sees only the approved Admin UI lists and fields.
- [ ] Partner sees and edits only content permitted by the ownership/field matrix.
- [ ] Direct GraphQL calls cannot bypass UI restrictions.
- [ ] Partner can check in registrations for all events without gaining broader registration-list access.
- [ ] Admin/editor workflows pass regression testing.
- [ ] Migration is verified against empty and representative existing databases.
- [ ] Product decisions, security test evidence, and operational documentation are complete.

## Estimate

- Product decision closure and threat model: 0.5–1 day
- Data model, migration, and shared authorization helpers: 1.5–2.5 days
- Admin UI visibility and Post/Comment enforcement: 2.5–4 days
- Poll/Event/Registration enforcement: 2.5–4 days
- Automated security/regression tests: 2–3 days
- Manual UAT, migration rehearsal, documentation, and fixes: 1.5–2.5 days

**Total:** approximately **10.5–17 working days**, depending on the unresolved product decisions and the amount of existing access-control behavior that needs regression repair.
