import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { relationship } from '@keystone-6/core/fields'
import {
    getPollVotePollAndOptionIds,
    syncPollVoteAggregates,
} from '../utils/poll-vote-count-sync'
import {
    buildPostVisibilityWhere,
    getAuthenticatedMemberId,
    isCmsRequest,
} from '../utils/post-visibility'

const listConfigurations = list({
  fields: {
    poll: relationship({
      ref: 'Poll',
      many: false,
      label: '投票活動',
    }),
    option: relationship({
      ref: 'PollOption',
      many: false,
      label: '投票選項',
    }),
    member: relationship({
      ref: 'Member',
      many: false,
      label: '投票會員',
    }),
  },
  ui: {
    label: '投票紀錄',
    listView: {
      initialColumns: ['poll', 'option', 'member'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
    filter: {
      // [AC-003] 非 CMS query 限制只能看自己的投票，且拒絕未登入存取。
      query: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) return false
        return {
          member: { id: { equals: memberId } },
          poll: {
            post: buildPostVisibilityWhere(memberId),
          },
        }
      },
      update: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) return false
        return { member: { id: { equals: memberId } } }
      },
    },
  },
  hooks: {
    // [AC-008] 建立票前先驗證 poll 可見性、option 歸屬、重複投票。
    validateInput: async ({ resolvedData, operation, addValidationError, context }) => {
      if (isCmsRequest(context) || operation !== 'create') return

      const pollConnect = (resolvedData.poll as { connect?: { id: number } } | undefined)?.connect
      const optionConnect = (resolvedData.option as { connect?: { id: number } } | undefined)?.connect

      if (!pollConnect?.id || !optionConnect?.id) {
        addValidationError('必須指定 poll 與 option')
        return
      }

      const pollId = pollConnect.id
      const optionId = optionConnect.id
      const memberId = getAuthenticatedMemberId(context)

      const poll = await context.prisma.poll.findFirst({
        where: {
          id: pollId,
          post: buildPostVisibilityWhere(memberId) as object,
        },
        select: { id: true },
      })
      if (!poll) {
        addValidationError('投票不存在或不可參與')
        return
      }

      const option = await context.prisma.pollOption.findFirst({
        where: { id: optionId, pollId },
        select: { id: true },
      })
      if (!option) {
        addValidationError('選項不屬於此投票')
        return
      }

      if (memberId) {
        const existing = await context.prisma.pollVote.findFirst({
          where: { pollId, memberId },
          select: { id: true },
        })
        if (existing) {
          addValidationError('每位會員每個投票只能投一票')
        }
      }
    },
    resolveInput: ({ operation, resolvedData, context }) => {
      if (isCmsRequest(context)) return resolvedData

      const memberId = getAuthenticatedMemberId(context)
      if (!memberId) {
        throw new Error('投票紀錄需要有效的會員登入狀態')
      }

      const data = { ...resolvedData }
      if (operation === 'create') {
        data.member = { connect: { id: memberId } }
      } else if (operation === 'update') {
        delete data.member
      }
      return data
    },
    afterOperation: async ({ operation, item, originalItem, context }) => {
      const pollIds: number[] = []
      const optionIds: number[] = []
      const push = (pollId: number | null, optionId: number | null) => {
        if (pollId != null) pollIds.push(pollId)
        if (optionId != null) optionIds.push(optionId)
      }
      if (operation === 'create' || operation === 'update') {
        const cur = getPollVotePollAndOptionIds(item as Record<string, unknown>)
        push(cur.pollId, cur.optionId)
      }
      if (operation === 'update' || operation === 'delete') {
        const prev = getPollVotePollAndOptionIds(
          originalItem as Record<string, unknown>
        )
        push(prev.pollId, prev.optionId)
      }
      await syncPollVoteAggregates(context.prisma, pollIds, optionIds)
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
