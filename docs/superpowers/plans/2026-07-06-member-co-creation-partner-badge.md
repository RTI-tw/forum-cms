# Member Co-Creation Partner Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CMS-managed `Member.isCoCreationPartner` flag and expose it through generated and custom member GraphQL fields.

**Architecture:** Store the badge flag directly on `Member` as a boolean with default `false`. Let Keystone generate the normal `Member` GraphQL field from the list field, and explicitly thread the same value through the custom member auth/session GraphQL type.

**Tech Stack:** Keystone 6 list fields, Prisma schema/migrations, GraphQL schema snapshot, Node assert tests run through `ts-node`.

---

### File Map

- Modify: `packages/forum-cms/lists/member.deletedUniqueFields.test.ts` for Member list and schema/source regression tests.
- Modify: `packages/forum-cms/lists/member.ts` to add the checkbox and list column.
- Modify: `packages/forum-cms/keystone.ts` to add the custom auth/session GraphQL field and mapper output.
- Modify: `packages/forum-cms/schema.prisma` to add the Prisma model field.
- Modify: `packages/forum-cms/schema.graphql` to update the checked-in GraphQL schema snapshot.
- Create: `packages/forum-cms/migrations/20260706120000_add_member_co_creation_partner/migration.sql`.

### Task 1: Tests

- [ ] **Step 1: Write failing tests**

Add tests to `packages/forum-cms/lists/member.deletedUniqueFields.test.ts` that:

```ts
async function testMemberCoCreationPartnerBadgeFieldConfig() {
  await withMemberConfig({}, (Member) => {
    assert.equal(
      typeof Member.fields?.isCoCreationPartner,
      'function',
      'Member should expose isCoCreationPartner field'
    )
    assert.ok(
      Member.ui?.listView?.initialColumns?.includes('isCoCreationPartner'),
      'Member list default columns should include isCoCreationPartner'
    )
  })
}
```

Also read source/schema files and assert they contain the checkbox label, default value, Prisma field, generated `Member` field, and custom `MemberSessionMember` field.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
cd packages/forum-cms
node -e "require('./node_modules/ts-node').register({ compilerOptions: { module: 'CommonJS' } }); require('./lists/member.deletedUniqueFields.test.ts')"
```

Expected: FAIL because `isCoCreationPartner` is not present.

### Task 2: Member Field And Migration

- [ ] **Step 1: Implement the Member list field**

In `packages/forum-cms/lists/member.ts`, add:

```ts
isCoCreationPartner: checkbox({
  label: '共創夥伴電子徽章',
  defaultValue: false,
}),
```

Add `isCoCreationPartner` to `ui.listView.initialColumns`.

- [ ] **Step 2: Update Prisma schema and migration**

In `packages/forum-cms/schema.prisma`, add:

```prisma
isCoCreationPartner                 Boolean                @default(false)
```

Create `packages/forum-cms/migrations/20260706120000_add_member_co_creation_partner/migration.sql`:

```sql
ALTER TABLE "Member" ADD COLUMN "isCoCreationPartner" BOOLEAN NOT NULL DEFAULT false;
```

### Task 3: Custom GraphQL Session Output

- [ ] **Step 1: Update custom types and mapper**

In `packages/forum-cms/keystone.ts`, add `isCoCreationPartner` to `MemberSessionMemberValue`, `MemberRecord`, the `MemberSessionMember` GraphQL object, the auth result member type, and `mapMemberSessionMember`.

The mapper should use:

```ts
isCoCreationPartner: Boolean(member.isCoCreationPartner),
```

- [ ] **Step 2: Update checked-in GraphQL schema**

In `packages/forum-cms/schema.graphql`, add:

```graphql
isCoCreationPartner: Boolean
```

to `type Member`, related input/filter/order types generated for Member, and:

```graphql
isCoCreationPartner: Boolean!
```

to `type MemberSessionMember`.

### Task 4: Verification

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd packages/forum-cms
node -e "require('./node_modules/ts-node').register({ compilerOptions: { module: 'CommonJS' } }); require('./lists/member.deletedUniqueFields.test.ts')"
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd packages/forum-cms
../../node_modules/.bin/tsc -p tsconfig.json --noEmit
```

Expected: PASS or only pre-existing unrelated failures. Any failure in modified files must be fixed.
