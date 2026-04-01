import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { relationship } from '@keystone-6/core/fields'
import {
    getPollVotePollAndOptionIds,
    syncPollVoteAggregates,
} from '../utils/poll-vote-count-sync'

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
      update: allowRoles(admin),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },
  hooks: {
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
