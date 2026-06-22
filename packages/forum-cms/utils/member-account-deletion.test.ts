import assert from 'assert'

import { softDeleteMemberByWhere } from './member-account-deletion'
import { signMemberSession } from './member-session'

type MemberRecord = {
  id: number
  status: string
  email: string
  firebaseId: string
  customId: string
}

function createContext(options: {
  tokenMemberId?: number
  session?: Record<string, unknown>
  foundMember?: MemberRecord | null
}) {
  const calls: Array<{ method: string; args: unknown }> = []
  const foundMember =
    options.foundMember === undefined
      ? {
          id: options.tokenMemberId ?? 1,
          status: 'active',
          email: 'user@example.com',
          firebaseId: 'firebase-uid',
          customId: 'custom-id',
        }
      : options.foundMember

  const authorization =
    options.tokenMemberId === undefined
      ? undefined
      : `Bearer ${signMemberSession({
          memberId: String(options.tokenMemberId),
          firebaseId: `firebase-${options.tokenMemberId}`,
        })}`

  const db = {
    Member: {
      async findOne(args: unknown) {
        calls.push({ method: 'findOne', args })
        return foundMember
      },
      async updateOne(args: { where: { id: string }; data: { status: string } }) {
        calls.push({ method: 'updateOne', args })
        return {
          ...foundMember,
          id: Number(args.where.id),
          status: args.data.status,
        }
      },
    },
  }

  const context = {
    req: { headers: authorization ? { authorization } : {} },
    session: options.session,
    sudo() {
      return { db }
    },
  }

  return { context: context as any, calls }
}

async function testFrontendMemberSoftDeletesSelf() {
  const { context, calls } = createContext({ tokenMemberId: 1 })

  const member = await softDeleteMemberByWhere(context, { id: '1' })

  assert.equal(member?.status, 'deleted')
  assert.deepEqual(calls, [
    { method: 'findOne', args: { where: { id: '1' } } },
    {
      method: 'updateOne',
      args: { where: { id: '1' }, data: { status: 'deleted' } },
    },
  ])
}

async function testFrontendMemberCannotDeleteAnotherMember() {
  const { context, calls } = createContext({
    tokenMemberId: 1,
    foundMember: {
      id: 2,
      status: 'active',
      email: 'other@example.com',
      firebaseId: 'firebase-other',
      customId: 'other-id',
    },
  })

  await assert.rejects(
    () => softDeleteMemberByWhere(context, { id: '2' }),
    /Cannot delete another member account/
  )

  assert.equal(
    calls.filter((call) => call.method === 'updateOne').length,
    0,
    'unauthorized member delete should not update the target member'
  )
}

async function main() {
  await testFrontendMemberSoftDeletesSelf()
  await testFrontendMemberCannotDeleteAnotherMember()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
