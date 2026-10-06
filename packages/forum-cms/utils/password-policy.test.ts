import assert from 'assert'
import {
  getPasswordChangeRequirement,
  resolvePasswordChangeRequirement,
  passwordPolicy,
  assertPasswordStrength,
  addToPasswordHistory,
  checkPasswordHistory,
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
  const originalNow = Date.now
  const now = Date.parse('2026-10-06T00:00:00Z')
  Date.now = () => now
  try {
    assert.equal(passwordPolicy.maxAgeDays, 180)
    assert.equal(passwordPolicy.isPasswordExpired({ passwordUpdatedAt: new Date(now - 180 * 86400000 + 1) }), false)
    assert.equal(passwordPolicy.isPasswordExpired({ passwordUpdatedAt: new Date(now - 180 * 86400000) }), true)
  } finally {
    Date.now = originalNow
  }
  assert.doesNotThrow(() => assertPasswordStrength('Abcdefghij12!'))
  for (const weak of ['Abcdefghi12!', 'abcdefghijklm', 'abcdefghijk12', '123456789012!']) {
    assert.throws(() => assertPasswordStrength(weak))
  }
  const bcrypt = await import('bcryptjs')
  const history = addToPasswordHistory(await bcrypt.hash('Previous1234!', 4), [await bcrypt.hash('OlderPass1234!', 4), await bcrypt.hash('OldestPass123!', 4)])
  assert.equal(history.length, 2)
  assert.equal(await checkPasswordHistory('Previous1234!', history), true)
  assert.equal(await checkPasswordHistory('OlderPass1234!', history), true)
  assert.equal(await checkPasswordHistory('OldestPass123!', history), false)
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
