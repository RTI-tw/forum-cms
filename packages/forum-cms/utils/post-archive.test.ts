import assert from 'assert'

import { archiveMemberPostByWhere } from './post-archive'
import { signMemberSession } from './member-session'

type PostRecord = {
  id: number
  status: string
  authorId: number | null
}

function createContext(options: {
  tokenMemberId?: number
  foundPost?: PostRecord | null
}) {
  const calls: Array<{ method: string; args: unknown }> = []
  const foundPost =
    options.foundPost === undefined
      ? { id: 10, status: 'published', authorId: options.tokenMemberId ?? 1 }
      : options.foundPost

  const authorization =
    options.tokenMemberId === undefined
      ? undefined
      : `Bearer ${signMemberSession({
          memberId: String(options.tokenMemberId),
          firebaseId: `firebase-${options.tokenMemberId}`,
        })}`

  const db = {
    Post: {
      async findOne(args: unknown) {
        calls.push({ method: 'db.findOne', args })
        return foundPost
      },
      async updateOne(args: {
        where: { id: string }
        data: { status: string }
      }) {
        calls.push({ method: 'db.updateOne', args })
        return { ...foundPost, id: Number(args.where.id), status: args.data.status }
      },
    },
  }

  const context = {
    req: { headers: authorization ? { authorization } : {} },
    prisma: {
      post: {
        async findUnique(args: unknown) {
          calls.push({ method: 'prisma.findUnique', args })
          return foundPost
        },
      },
    },
    sudo() {
      return { db }
    },
  }

  return { context: context as any, calls }
}

async function testAuthorArchivesOwnPost() {
  const { context, calls } = createContext({ tokenMemberId: 1 })

  const post = await archiveMemberPostByWhere(context, { id: '10' })

  assert.equal(post?.status, 'archived')
  assert.deepEqual(
    calls.filter((call) => call.method === 'db.updateOne'),
    [
      {
        method: 'db.updateOne',
        args: { where: { id: '10' }, data: { status: 'archived' } },
      },
    ]
  )
}

async function testMemberCannotArchiveAnotherAuthorPost() {
  const { context, calls } = createContext({
    tokenMemberId: 1,
    foundPost: { id: 10, status: 'published', authorId: 2 },
  })

  await assert.rejects(
    () => archiveMemberPostByWhere(context, { id: '10' }),
    /Cannot delete another member post/
  )

  assert.equal(
    calls.filter((call) => call.method === 'db.updateOne').length,
    0,
    'a non-author must not be able to archive the post'
  )
}

async function testAnonymousRequestIsRejected() {
  const { context, calls } = createContext({})

  await assert.rejects(
    () => archiveMemberPostByWhere(context, { id: '10' }),
    /Member session is required/
  )

  assert.equal(calls.length, 0, 'anonymous requests must not read or write')
}

async function testAlreadyArchivedPostIsNotWrittenAgain() {
  const { context, calls } = createContext({
    tokenMemberId: 1,
    foundPost: { id: 10, status: 'archived', authorId: 1 },
  })

  const post = await archiveMemberPostByWhere(context, { id: '10' })

  assert.equal(post?.status, 'archived')
  assert.equal(
    calls.filter((call) => call.method === 'db.updateOne').length,
    0,
    'archiving twice should be idempotent'
  )
}

async function testMissingPostReturnsNull() {
  const { context, calls } = createContext({
    tokenMemberId: 1,
    foundPost: null,
  })

  assert.equal(await archiveMemberPostByWhere(context, { id: '10' }), null)
  assert.equal(
    calls.filter((call) => call.method === 'db.updateOne').length,
    0,
    'a missing post must not be written'
  )
}

async function testInvalidWhereIsRejected() {
  const { context } = createContext({ tokenMemberId: 1 })

  await assert.rejects(
    () => archiveMemberPostByWhere(context, {}),
    /Post identifier is required/
  )
  await assert.rejects(
    () => archiveMemberPostByWhere(context, { id: 'not-a-number' }),
    /Post identifier is invalid/
  )
}

async function main() {
  await testAuthorArchivesOwnPost()
  await testMemberCannotArchiveAnotherAuthorPost()
  await testAnonymousRequestIsRejected()
  await testAlreadyArchivedPostIsNotWrittenAgain()
  await testMissingPostReturnsNull()
  await testInvalidWhereIsRejected()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
