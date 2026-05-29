import assert from 'assert'
import {
  getPasswordChangeRequirement,
  resolvePasswordChangeRequirement,
} from './password-policy'

async function testFreshUserStateOverridesStaleSessionRequirement() {
  let freshLookups = 0
  const freshPasswordUpdatedAt = new Date().toISOString()

  const requiresChange = await resolvePasswordChangeRequirement(
    {
      mustChangePassword: true,
      passwordUpdatedAt: '2000-01-01T00:00:00.000Z',
    },
    async () => {
      freshLookups += 1
      return {
        mustChangePassword: false,
        passwordUpdatedAt: freshPasswordUpdatedAt,
      }
    }
  )

  assert.equal(freshLookups, 1)
  assert.equal(requiresChange, false)
}

async function main() {
  await testFreshUserStateOverridesStaleSessionRequirement()
  testClientPolicyIgnoresIncompleteAuthenticatedItemPayload()
}

function testClientPolicyIgnoresIncompleteAuthenticatedItemPayload() {
  assert.equal(
    getPasswordChangeRequirement({ __typename: 'User', id: '1' }, 1000),
    null
  )
  assert.equal(
    getPasswordChangeRequirement({ mustChangePassword: true }, 1000),
    true
  )
  assert.equal(
    getPasswordChangeRequirement({ mustChangePassword: false }, 1000),
    true
  )
  assert.equal(
    getPasswordChangeRequirement(
      {
        mustChangePassword: false,
        passwordUpdatedAt: new Date().toISOString(),
      },
      1000
    ),
    false
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
