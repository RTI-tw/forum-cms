# Event Registration and QR Check-in Design

## Purpose

Add event registration management to the CMS and support QR based on-site check-in from the frontend user profile page. The design should reduce screenshot forwarding risk by using short-lived, dynamic, one-time QR tokens instead of permanent QR codes.

This design targets the current Keystone 6 CMS in `packages/forum-cms`, which already has:

- Keystone lists under `packages/forum-cms/lists`.
- Admin UI customization through `packages/forum-cms/admin/config.ts`.
- Additional Keystone admin pages generated through `ui.getAdditionalFiles` in `packages/forum-cms/keystone.ts`.
- Member authentication through bearer member session JWTs.
- CMS user authentication through Keystone session.

## Goals

- Let admins create and manage events in the CMS.
- Let members register for events.
- Let the frontend show each logged-in member a QR code for their own registration.
- Let admins scan the QR code from a custom admin page and check the member in.
- Let admins discard a scanned QR without changing data.
- Let admins cancel a registration where the workflow allows it.
- Reduce QR screenshot forwarding risk by making QR tokens short-lived, dynamic, one-time use, and bound to one registration.

## Non-goals

- Fully preventing real-time screenshot forwarding in pure QR mode.
- Building a complete public event discovery page.
- Sending QR code emails.
- Storing generated QR images as uploaded media.
- Replacing the existing member authentication model.

## Security Model

The QR code must not contain a stable identifier such as `memberId`, `registrationId`, or a long-lived registration token.

The QR code should contain only an opaque check-in token. The token is:

- Created only after validating the frontend member session.
- Bound to exactly one `EventRegistration`.
- Short-lived, for example 15-30 seconds.
- Rotated while the profile page is open.
- Single-use.
- Stored as a hash in the database, not as plaintext.
- Invalidated when a newer token is issued for the same registration.

This makes old screenshots and delayed forwarded screenshots fail. A screenshot forwarded and scanned within the active token window can still work. If the product requirement becomes "a forwarded screenshot must not work even immediately," add user-side confirmation after admin scan.

## Recommended Lists

### Event

Represents an activity that can receive registrations.

Suggested fields:

- `title`: text, required.
- `slug`: text, required, unique, for FE routing and stable API lookup.
- `description`: text or document, optional.
- `startAt`: timestamp, optional.
- `endAt`: timestamp, optional.
- `registrationStartAt`: timestamp, optional.
- `registrationEndAt`: timestamp, optional.
- `capacity`: integer, optional.
- `status`: select enum.
  - `draft`
  - `published`
  - `closed`
  - `cancelled`
- `registrations`: relationship to `EventRegistration.event`, many.

CMS access:

- Query/create/update: admin, moderator, editor.
- Delete: admin and editor, or admin only if event history should be preserved.

Admin UI:

- Label: `活動`.
- Initial columns: `title`, `status`, `startAt`, `registrationEndAt`.

### EventRegistration

Represents one member's registration for one event.

Suggested fields:

- `event`: relationship to `Event.registrations`, required.
- `member`: relationship to `Member.eventRegistrations`, required.
- `status`: select enum.
  - `registered`: active registration.
  - `checkedIn`: check-in completed.
  - `cancelled`: registration cancelled.
  - `rejected`: optional, if admins can reject registrations.
- `registeredAt`: timestamp, default now.
- `cancelledAt`: timestamp, optional.
- `cancelledBy`: relationship to `User`, optional.
- `checkedInAt`: timestamp, optional.
- `checkedInBy`: relationship to `User`, optional.
- `lastQrTokenHash`: text, optional, hidden from CMS UI.
- `lastQrTokenExpiresAt`: timestamp, optional, hidden from CMS UI.
- `lastQrTokenUsedAt`: timestamp, optional, hidden from CMS UI.
- `lastQrTokenIssuedAt`: timestamp, optional, hidden from CMS UI.
- `checkInNotes`: text, optional, admin-visible.

Recommended DB constraints:

- Unique registration per member per event: `(eventId, memberId)`.
- Index `eventId`, `memberId`, `status`.
- Index `lastQrTokenHash` if token verification queries by hash.

Keystone list-level validation can prevent duplicates, but the database should enforce uniqueness as the final guard.

CMS access:

- Admin/moderator/editor can query and update.
- Public frontend registration creation should not use normal admin list access directly. Prefer a dedicated GraphQL mutation or API endpoint that authenticates a member session and applies business rules.
- Delete should generally be restricted. Prefer status transitions over deletion.

Admin UI:

- Label: `活動報名`.
- Initial columns: `event`, `member`, `status`, `registeredAt`, `checkedInAt`.
- Hide QR token fields from create, item, and list views.

### Member Relationship Update

Add the reverse relationship to `Member`:

- `eventRegistrations`: relationship to `EventRegistration.member`, many.

This lets the CMS and API query a member's registrations without storing QR state on the member itself. QR state belongs to the registration because check-in is event-specific.

## QR Token Design

### Token Format

Generate a high-entropy random token, for example 32 bytes from a cryptographically secure random source, base64url encoded.

QR payload options:

- Token only: `evtqr_<opaque-token>`.
- URL: `https://cms.example.com/event-checkin?token=<opaque-token>`.

For admin scanner UX, token-only is cleaner if the scanner page directly reads camera frames and posts the token to the API. URL is useful if admins may scan with the device camera outside the CMS browser.

### Storage

Store only a hash:

- `lastQrTokenHash = sha256(token + serverSecretOrPepper)`
- `lastQrTokenExpiresAt = now + 15-30 seconds`
- `lastQrTokenUsedAt = null`
- `lastQrTokenIssuedAt = now`

Using a server-side pepper means a database leak does not immediately expose valid QR tokens.

### Rotation

When FE requests a new QR token:

1. Verify the member bearer session.
2. Load the target registration.
3. Confirm the registration belongs to the authenticated member.
4. Confirm the event and registration are eligible for check-in.
5. Generate and store the new token hash.
6. Overwrite any previous unexpired token for that registration.
7. Return the plaintext token and expiry timestamp to FE.

The admin check-in endpoint accepts only the currently stored, unexpired, unused token. Older screenshots fail after rotation.

## Backend API Design

### Member: Register for Event

Mutation or endpoint:

- `registerForEvent(eventSlugOrId)`

Input:

- `eventId` or `eventSlug`.

Auth:

- Requires member bearer session.

Behavior:

1. Verify member session.
2. Load event.
3. Confirm event status allows registration.
4. Confirm registration window allows registration.
5. Confirm capacity is not exceeded, if capacity is configured.
6. Create `EventRegistration` with `status = registered`.
7. Enforce unique `(eventId, memberId)`.
8. Return registration summary.

### Member: Get My Event Registrations

Query or endpoint:

- `myEventRegistrations`

Auth:

- Requires member bearer session.

Behavior:

- Return registrations for the authenticated member.
- Include event fields needed by the FE profile page.
- Do not return QR token hashes.

### Member: Issue Check-in QR Token

Mutation or endpoint:

- `issueEventCheckInQrToken(registrationId)`

Input:

- `registrationId`.

Auth:

- Requires member bearer session.

Behavior:

1. Verify member session.
2. Load registration and event.
3. Confirm `registration.memberId === authenticatedMember.id`.
4. Confirm `registration.status === registered`.
5. Confirm event is check-in eligible.
6. Generate short-lived one-time token.
7. Store token hash and expiry on `EventRegistration`.
8. Return:
   - `token`
   - `expiresAt`
   - `refreshAfterSeconds`

Error cases:

- Not authenticated.
- Registration not found.
- Registration does not belong to member.
- Registration cancelled.
- Already checked in.
- Event not open for check-in.

### Admin: Preview Check-in Token

Mutation or endpoint:

- `previewEventCheckInToken(token)`

Auth:

- Requires CMS user session.
- Requires role allowed to perform check-in.

Behavior:

1. Hash token.
2. Find registration by `lastQrTokenHash`.
3. Confirm token is not expired and not used.
4. Confirm registration can be checked in.
5. Return a preview:
   - event title
   - member display name
   - registration status
   - registeredAt
   - whether check-in is allowed

This lets the admin scanner page show the person and event before committing.

### Admin: Confirm Check-in

Mutation or endpoint:

- `confirmEventCheckIn(token)`

Auth:

- Requires CMS user session.
- Requires role allowed to perform check-in.

Behavior:

1. Hash token.
2. In a transaction or atomic update:
   - Match `lastQrTokenHash`.
   - Require `lastQrTokenExpiresAt > now`.
   - Require `lastQrTokenUsedAt IS NULL`.
   - Require `status = registered`.
3. Set:
   - `status = checkedIn`
   - `checkedInAt = now`
   - `checkedInBy = current CMS user`
   - `lastQrTokenUsedAt = now`
4. Return updated registration summary.

Concurrency requirement:

- Two admins scanning the same QR at the same time must not both succeed.
- Use a transaction or an update condition that only succeeds while token is unused and registration is still `registered`.

### Admin: Cancel Registration or Undo Check-in

Mutation or endpoint:

- `cancelEventRegistration(registrationId, reason?)`
- Optional: `undoEventCheckIn(registrationId, reason?)`

Auth:

- Requires CMS user session.
- Requires role allowed to update registrations.

Behavior:

- Cancellation sets:
  - `status = cancelled`
  - `cancelledAt = now`
  - `cancelledBy = current CMS user`
  - clear or invalidate QR token fields.
- Undo check-in should be explicit and audited if allowed.

## Frontend User Profile Responsibilities

The FE profile page should:

1. Load the authenticated member's event registrations.
2. Show registration status per event.
3. For an eligible `registered` registration, request a check-in QR token.
4. Render QR from the returned token.
5. Display an expiry countdown.
6. Refresh the token before expiry, for example every 10-15 seconds.
7. Stop refreshing when:
   - page is hidden for a sustained period,
   - user leaves the profile page,
   - registration becomes `checkedIn` or `cancelled`.
8. Handle API errors clearly:
   - logged out,
   - registration cancelled,
   - already checked in,
   - event not open for check-in.

The FE must not generate or sign QR tokens locally. It only renders server-issued tokens.

## Admin Page Responsibilities

Add a custom Keystone admin page, for example:

- `/event-checkin`

The page should be generated through Keystone `ui.getAdditionalFiles`, following the existing custom pages pattern.

The page should:

1. Require CMS session through normal Keystone admin access.
2. Use the browser camera to scan QR codes.
3. Parse token or token URL.
4. Call preview API after a scan.
5. Display event, member, and registration state.
6. Provide a clear `確認報到` button.
7. Provide a `取消掃描` button to discard the current scanned token without changing data.
8. Show clear terminal states:
   - check-in success,
   - token expired,
   - token already used,
   - registration cancelled,
   - already checked in,
   - permission denied.
9. Debounce scan handling so the same QR frame does not trigger repeated requests.

The existing custom navigation can add an `活動報到` link to this page.

Camera scanning requires HTTPS in production. Localhost can be used for development.

If admins also need to cancel the registration from this page, that should be a separate destructive action such as `取消報名`, with a confirmation dialog and optional reason. It should not share the same button semantics as discarding the current scan.

## Optional Stronger Anti-forwarding Flow

If short-lived QR is not enough, add a two-step confirmation flow:

1. Admin scans QR.
2. Backend creates a short pending check-in request.
3. FE profile page, using the real member session, shows "Confirm check-in?".
4. User taps confirm on their own logged-in device.
5. Backend completes check-in only after both admin scan and member confirmation.

This is stronger against immediate screenshot forwarding because the screenshot alone is not sufficient. The tradeoff is slower on-site operations and more frontend complexity.

Recommended rollout:

1. MVP: dynamic short-lived one-time QR.
2. Upgrade to member-side confirmation only if event policy requires stronger anti-forwarding.

## Data Flow

### Registration

1. Member logs in on FE.
2. FE calls `registerForEvent`.
3. CMS verifies member session and event eligibility.
4. CMS creates `EventRegistration`.
5. FE shows the registration on the profile page.

### QR Display

1. Member opens profile page.
2. FE calls `issueEventCheckInQrToken(registrationId)`.
3. CMS verifies member session and registration ownership.
4. CMS stores token hash and expiry on the registration.
5. FE renders QR and refreshes it before expiry.

### Admin Check-in

1. Admin opens `/event-checkin`.
2. Admin scans the QR from the member's profile page.
3. Admin page calls `previewEventCheckInToken`.
4. Admin confirms.
5. Admin page calls `confirmEventCheckIn`.
6. CMS atomically consumes the token and updates registration to `checkedIn`.
7. Admin page shows success.
8. FE profile page eventually refreshes registration status and stops showing QR.

## Error Handling

Token errors:

- Expired token: "QR code expired. Ask the member to refresh their profile page."
- Used token: "This QR code was already used."
- Replaced token: "This QR code is no longer current."
- Invalid token: "QR code is invalid."

Registration errors:

- Cancelled registration: "This registration was cancelled."
- Already checked in: "This member has already checked in."
- Not eligible: "This event is not open for check-in."

Permission errors:

- Member endpoint without bearer session returns 401.
- Admin endpoint without CMS session returns 401.
- Admin endpoint with insufficient role returns 403.

## Auditing

At minimum, keep:

- `registeredAt`
- `checkedInAt`
- `checkedInBy`
- `cancelledAt`
- `cancelledBy`

If operational auditability matters, add a separate `EventRegistrationLog` list:

- `registration`
- `action`
- `actorType`: `member` or `cmsUser`
- `actorMember`
- `actorUser`
- `createdAt`
- `metadata`

For MVP, the timestamp/user fields on `EventRegistration` are enough.

## Testing Plan

Backend tests:

- Member can register for a published event.
- Member cannot register twice for the same event.
- Member cannot issue QR for another member's registration.
- QR token expires.
- Issuing a new QR invalidates the previous one.
- QR token can be used only once.
- Check-in update is atomic under duplicate scan attempts.
- Cancelled and already checked-in registrations cannot be checked in again.
- Admin role restrictions are enforced.

Frontend tests:

- Profile page requests and refreshes QR token.
- QR countdown updates.
- QR stops refreshing after check-in/cancelled status.
- Expired token response is handled.

Admin page tests:

- Camera scanner parses token payload.
- Preview state displays the correct member and event.
- Confirm button calls check-in once.
- Repeated frames do not send duplicate requests.
- Success and failure states are clear.

## Implementation Notes

- Add `Event` and `EventRegistration` to `packages/forum-cms/lists`.
- Export both from `packages/forum-cms/lists/index.ts`.
- Add the reverse `eventRegistrations` relationship to `Member`.
- Add a migration for the new tables, indexes, and unique constraint.
- Add member-facing GraphQL mutations/queries in `keystone.ts` schema extension or equivalent route handlers.
- Add admin-facing preview and confirm mutations or Express API endpoints.
- Add the admin page through `ui.getAdditionalFiles`.
- Add `活動報到` to `CustomNavigation`.
- Add QR generation on FE using a client QR rendering library. The CMS backend should issue token data; it does not need to generate an image for the FE profile page.

## Open Decisions

- QR lifetime: recommend 15-30 seconds.
- QR refresh interval: recommend 10-15 seconds.
- Whether check-in is allowed only during event time or during a separate check-in window.
- Which CMS roles can check in attendees.
- Whether admins can undo check-in after success.
- Whether event capacity is required for MVP.
- Whether FE will scan registration by `eventSlug` or `eventId`.

## Recommended MVP Scope

Build the first version with:

- `Event` list.
- `EventRegistration` list.
- Member registration API.
- Member "my registrations" API.
- Member QR token issuing API.
- Admin QR preview API.
- Admin check-in API.
- Custom admin scanner page.
- Short-lived, rotating, one-time QR token.

Defer:

- Member-side confirmation.
- Registration logs list.
- Email delivery.
- Public event discovery.
- QR image storage.
