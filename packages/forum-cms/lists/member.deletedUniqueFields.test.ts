import assert from 'assert'
import fs from 'fs'
import path from 'path'

const MEMBER_MODULE_PATH = require.resolve('./member')
const ACCESS_CONTROL_MODULE_PATH = require.resolve('../utils/access-control')
const API_ACCESS_RULES_MODULE_PATH = require.resolve('../utils/api-access-rules')
const FORUM_CMS_ROOT = path.resolve(__dirname, '..')

type EnvPatch = {
  ACCESS_CONTROL_STRATEGY?: string
  ACCESS_CONTROL_API_RULES_JSON?: string
}

async function withMemberConfig<T>(
  envPatch: EnvPatch,
  callback: (Member: any) => Promise<T> | T
) {
  const previousStrategy = process.env.ACCESS_CONTROL_STRATEGY
  const previousApiRules = process.env.ACCESS_CONTROL_API_RULES_JSON

  if (envPatch.ACCESS_CONTROL_STRATEGY === undefined) {
    delete process.env.ACCESS_CONTROL_STRATEGY
  } else {
    process.env.ACCESS_CONTROL_STRATEGY = envPatch.ACCESS_CONTROL_STRATEGY
  }

  if (envPatch.ACCESS_CONTROL_API_RULES_JSON === undefined) {
    delete process.env.ACCESS_CONTROL_API_RULES_JSON
  } else {
    process.env.ACCESS_CONTROL_API_RULES_JSON =
      envPatch.ACCESS_CONTROL_API_RULES_JSON
  }

  delete require.cache[MEMBER_MODULE_PATH]
  delete require.cache[ACCESS_CONTROL_MODULE_PATH]
  delete require.cache[API_ACCESS_RULES_MODULE_PATH]

  try {
    const Member = require('./member').default
    return await callback(Member)
  } finally {
    if (previousStrategy === undefined) {
      delete process.env.ACCESS_CONTROL_STRATEGY
    } else {
      process.env.ACCESS_CONTROL_STRATEGY = previousStrategy
    }

    if (previousApiRules === undefined) {
      delete process.env.ACCESS_CONTROL_API_RULES_JSON
    } else {
      process.env.ACCESS_CONTROL_API_RULES_JSON = previousApiRules
    }

    delete require.cache[MEMBER_MODULE_PATH]
    delete require.cache[ACCESS_CONTROL_MODULE_PATH]
    delete require.cache[API_ACCESS_RULES_MODULE_PATH]
  }
}

async function resolveMemberInput(
  resolvedData: Record<string, unknown>,
  item: Record<string, unknown>
) {
  return withMemberConfig({}, async (Member) => {
    const resolveInput = Member.hooks?.resolveInput
    assert.equal(typeof resolveInput, 'function')

    return await resolveInput({
      resolvedData,
      item,
      context: { session: null },
    })
  })
}

async function testDeletedStatusReleasesUniqueMemberFields() {
  const output = await resolveMemberInput(
    { status: 'deleted' },
    {
      id: 123,
      status: 'active',
      email: 'user@example.com',
      firebaseId: 'firebase-uid',
      customId: 'custom-id',
      name: 'Test User',
      nickname: 'Tester',
    }
  )

  assert.equal(output.status, 'deleted')
  assert.equal(output.email, 'DELETED-123-user@example.com')
  assert.equal(output.firebaseId, 'DELETED-123-firebase-uid')
  assert.equal(output.customId, 'DELETED-123-custom-id')
}

async function testDeletedStatusDoesNotRewriteAlreadyDeletedMember() {
  const output = await resolveMemberInput(
    { status: 'deleted' },
    {
      id: 123,
      status: 'deleted',
      email: 'DELETED-123-user@example.com',
      firebaseId: 'DELETED-123-firebase-uid',
      customId: 'DELETED-123-custom-id',
      name: 'Test User',
      nickname: 'Tester',
    }
  )

  assert.equal(output.status, 'deleted')
  assert.equal(output.email, undefined)
  assert.equal(output.firebaseId, undefined)
  assert.equal(output.customId, undefined)
}

async function testMemberExposesGeneratedHardDeleteMutations() {
  await withMemberConfig({}, (Member) => {
    const graphqlConfig = Member.graphql

    assert.notEqual(
      graphqlConfig?.omit?.delete,
      true,
      'Member should expose Keystone generated hard-delete mutations for CMS'
    )
  })
}

async function testApiStrategyCannotHardDeleteMembersEvenWhenRulesAllowWrites() {
  await withMemberConfig(
    {
      ACCESS_CONTROL_STRATEGY: 'api',
      ACCESS_CONTROL_API_RULES_JSON: JSON.stringify({ Member: 'read_write' }),
    },
    async (Member) => {
      const deleteAccess = Member.access?.operation?.delete
      assert.equal(typeof deleteAccess, 'function')

      const allowed = await deleteAccess({
        listKey: 'Member',
        operation: 'delete',
        context: {},
      })

      assert.equal(
        allowed,
        false,
        'api strategy must not hard-delete members even when Member has read_write API rules'
      )
    }
  )
}

async function testMemberListDefaultsShowAndSortByCreatedAt() {
  await withMemberConfig({}, (Member) => {
    const listView = Member.ui?.listView

    assert.ok(
      listView?.initialColumns?.includes('createdAt'),
      'Member list default columns should include createdAt'
    )
    assert.deepEqual(
      listView?.initialSort,
      { field: 'createdAt', direction: 'DESC' },
      'Member list should default sort by createdAt desc'
    )
  })
}

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

function readForumCmsSource(relativePath: string) {
  return fs.readFileSync(path.join(FORUM_CMS_ROOT, relativePath), 'utf8')
}

function extractSchemaBlock(schema: string, blockName: string) {
  const block = schema.match(new RegExp(`${blockName} \\{[\\s\\S]*?\\n\\}`))?.[0]
  assert.ok(block, `${blockName} should exist in schema.graphql`)
  return block
}

function testMemberCoCreationPartnerBadgeSource() {
  const memberSource = readForumCmsSource('lists/member.ts')

  assert.match(
    memberSource,
    /isCoCreationPartner:\s*checkbox\(\{[\s\S]*label:\s*'共創夥伴電子徽章'[\s\S]*defaultValue:\s*false[\s\S]*\}\)/,
    'Member isCoCreationPartner should be a checkbox labeled 共創夥伴電子徽章 with default false'
  )
}

function testMemberSessionGraphqlExposesCoCreationPartnerBadge() {
  const keystoneSource = readForumCmsSource('keystone.ts')

  assert.match(
    keystoneSource,
    /isCoCreationPartner:\s*boolean/,
    'Member session value type should include isCoCreationPartner'
  )
  assert.match(
    keystoneSource,
    /isCoCreationPartner\?:\s*boolean\s*\|\s*null/,
    'Member record type should include nullable isCoCreationPartner'
  )
  assert.match(
    keystoneSource,
    /isCoCreationPartner:\s*graphql\.field\(\{\s*type:\s*graphql\.nonNull\(graphql\.Boolean\)\s*\}\)/,
    'MemberSessionMember GraphQL type should expose non-null isCoCreationPartner'
  )
  assert.match(
    keystoneSource,
    /isCoCreationPartner:\s*Boolean\(member\.isCoCreationPartner\)/,
    'Member session mapper should return isCoCreationPartner'
  )
}

function testMemberSchemaExposesCoCreationPartnerBadge() {
  const schema = readForumCmsSource('schema.graphql')
  const memberType = extractSchemaBlock(schema, 'type Member')
  const memberWhereInput = extractSchemaBlock(schema, 'input MemberWhereInput')
  const memberOrderByInput = extractSchemaBlock(schema, 'input MemberOrderByInput')
  const memberUpdateInput = extractSchemaBlock(schema, 'input MemberUpdateInput')
  const memberCreateInput = extractSchemaBlock(schema, 'input MemberCreateInput')
  const memberSessionType = extractSchemaBlock(schema, 'type MemberSessionMember')

  assert.match(
    memberType,
    /isCoCreationPartner:\s*Boolean/,
    'Member schema type should expose isCoCreationPartner'
  )
  assert.match(
    memberWhereInput,
    /isCoCreationPartner:\s*BooleanFilter/,
    'MemberWhereInput should filter by isCoCreationPartner'
  )
  assert.match(
    memberOrderByInput,
    /isCoCreationPartner:\s*OrderDirection/,
    'MemberOrderByInput should sort by isCoCreationPartner'
  )
  assert.match(
    memberUpdateInput,
    /isCoCreationPartner:\s*Boolean/,
    'MemberUpdateInput should allow updating isCoCreationPartner'
  )
  assert.match(
    memberCreateInput,
    /isCoCreationPartner:\s*Boolean/,
    'MemberCreateInput should allow creating isCoCreationPartner'
  )
  assert.match(
    memberSessionType,
    /isCoCreationPartner:\s*Boolean!/,
    'MemberSessionMember should expose non-null isCoCreationPartner'
  )
}

async function main() {
  await testMemberExposesGeneratedHardDeleteMutations()
  await testApiStrategyCannotHardDeleteMembersEvenWhenRulesAllowWrites()
  await testMemberListDefaultsShowAndSortByCreatedAt()
  await testMemberCoCreationPartnerBadgeFieldConfig()
  testMemberCoCreationPartnerBadgeSource()
  testMemberSessionGraphqlExposesCoCreationPartnerBadge()
  testMemberSchemaExposesCoCreationPartnerBadge()
  await testDeletedStatusReleasesUniqueMemberFields()
  await testDeletedStatusDoesNotRewriteAlreadyDeletedMember()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
