const assert = require('assert')

process.env.ACCESS_CONTROL_STRATEGY = 'cms'

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
})

const {
  applyCommentUpdateCmsRules,
  applyPostUpdateCmsRules,
} = require('./cms-content-moderation')

function partnerContext(memberId) {
  const member = { id: memberId }
  return {
    session: { itemId: '7', data: { id: 7, role: 'partner' } },
    sudo() {
      return this
    },
    prisma: {
      user: {
        findUnique: async () => ({
          role: 'partner',
          partnerMember: { ...member, status: 'active' },
        }),
      },
      officialMapping: {
        findFirst: async () => null,
      },
      post: {
        findUnique: async () => ({ author: member }),
      },
      comment: {
        findUnique: async () => ({ member }),
      },
    },
  }
}

async function main() {
  const context = partnerContext(12)
  const postUpdate = { title: '新標題', content: '新貼文內容' }
  const commentUpdate = { content: '新留言內容' }

  assert.deepEqual(
    await applyPostUpdateCmsRules(context, 'update', { id: 31 }, postUpdate),
    postUpdate
  )
  assert.deepEqual(
    await applyCommentUpdateCmsRules(
      context,
      'update',
      { id: 41 },
      commentUpdate
    ),
    commentUpdate
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
