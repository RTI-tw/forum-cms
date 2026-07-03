import assert from 'assert'

const MEMBER_MODULE_PATH = require.resolve('./member')
const ACCESS_CONTROL_MODULE_PATH = require.resolve('../utils/access-control')
const API_ACCESS_RULES_MODULE_PATH = require.resolve('../utils/api-access-rules')

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

async function main() {
  await testMemberExposesGeneratedHardDeleteMutations()
  await testApiStrategyCannotHardDeleteMembersEvenWhenRulesAllowWrites()
  await testMemberListDefaultsShowAndSortByCreatedAt()
  await testDeletedStatusReleasesUniqueMemberFields()
  await testDeletedStatusDoesNotRewriteAlreadyDeletedMember()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
