import assert from 'assert'
import { resolvePasswordChangeRequirement } from './password-policy'

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
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
