const assert = require('assert')

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
})

const {
  connectedId,
  connectedIds,
  getPartnerMemberId,
  isPartnerSession,
} = require('./partner-access')

function context({ role = 'partner', userRole = role, member = null } = {}) {
  return {
    session: { itemId: '7', data: { id: 7, role } },
    sudo() { return this },
    prisma: {
      user: {
        findUnique: async () => ({ role: userRole, partnerMember: member }),
      },
    },
  }
}

async function main() {
  assert.equal(isPartnerSession(context()), true)
  assert.equal(isPartnerSession(context({ role: 'admin' })), false)
  assert.equal(
    await getPartnerMemberId(context({ member: { id: 12, status: 'active' } })),
    12
  )
  assert.equal(
    await getPartnerMemberId(context({ member: { id: 12, status: 'inactive' } })),
    null
  )
  assert.equal(
    await getPartnerMemberId(context({ userRole: 'editor', member: { id: 12, status: 'active' } })),
    null
  )
  assert.equal(connectedId({ connect: { id: 3 } }), 3)
  assert.deepEqual(connectedIds({ connect: [{ id: 3 }, { id: 4 }] }), [3, 4])
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
