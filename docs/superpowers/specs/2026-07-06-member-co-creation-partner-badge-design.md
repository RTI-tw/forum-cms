# Member Co-Creation Partner Badge Design

## Goal

Add an independent Member flag that lets CMS admins mark a frontend member as a co-creation partner, and expose that flag through GraphQL so the frontend can render a badge next to the member avatar or nickname.

## Scope

This change only adds the backend data and GraphQL surface required for the badge. It does not implement the frontend visual badge component.

## Data Model

- Add `Member.isCoCreationPartner`.
- Type: boolean.
- Default: `false`.
- Existing members should not show the badge until an admin enables it.
- The field is independent from `Member.isOfficial`; official-account behavior must not change.

## CMS Behavior

The Member list gets a checkbox field labeled `共創夥伴電子徽章`.

The checkbox appears in the Member list initial columns so CMS users can scan and edit the setting from the member management area.

## GraphQL Behavior

The generated `Member` GraphQL type exposes `isCoCreationPartner`.

The custom member auth/session GraphQL shape also exposes `isCoCreationPartner` on `MemberSessionMember`, including:

- `authenticatedMember`
- `authenticateMemberWithFirebase`

This lets the frontend read the flag either from public/member queries or from the logged-in member session payload.

## Migration

Add a Prisma migration that adds `Member.isCoCreationPartner` as a non-null boolean with `false` as the default.

## Testing

Add focused tests that verify:

- The Member list defines `isCoCreationPartner` as a checkbox with default `false`.
- The Member list initial columns include `isCoCreationPartner`.
- The custom session member mapping and GraphQL type include `isCoCreationPartner`.
- The checked-in schema snapshot exposes the field on both `Member` and `MemberSessionMember`.
