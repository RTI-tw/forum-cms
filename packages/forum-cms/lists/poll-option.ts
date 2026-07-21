import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor, partner } from '../utils/access-control'
import { connectedId, getPartnerMemberId, isPartnerSession, isPartnerUiSession, partnerOwnsPoll } from '../utils/partner-access'
import { list } from '@keystone-6/core'
import { text, integer, relationship } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'
import { applyPollOptionUpdateTranslationOnly } from '../utils/cms-content-moderation'
import {
  buildPostVisibilityWhere,
  canReadTrustedBackendContent,
  getAuthenticatedMemberId,
} from '../utils/post-visibility'

/**
 * 欄位規格：
 * - 選項（原文）：最多 20 字
 * - 選項（五國語言）：中／英／越／印尼／泰，對應 text_zh … text_th
 * - 所屬投票：Poll
 * - 得票數：voteCount（可與 PollVote 對照或手動調整）
 */
const listConfigurations = list({
  fields: {
    text: text({
      validation: {
        isRequired: true,
        length: { max: 20 },
      },
      label: '選項（原文）',
      ui: {
        description: '最多 20 字（含空格與標點）。',
      },
    }),
    text_zh: text({
      label: '選項（中文）',
      ui: {
        description: '五國語言翻譯欄位之一；可透過 message-services 依原文同步。',
      },
    }),
    text_en: text({ label: '選項（英文）' }),
    text_vi: text({ label: '選項（越南文）' }),
    text_id: text({ label: '選項（印尼文）' }),
    text_th: text({ label: '選項（泰文）' }),
    poll: relationship({
      ref: 'Poll.options',
      many: false,
      label: '所屬投票',
      ui: {
        description: '此選項所屬的投票活動。',
      },
    }),
    voteCount: integer({
      label: '得票數',
      defaultValue: 0,
      ui: {
        description:
          '由「投票紀錄」建立／變更／刪除時自動重算；與該選項之 PollVote 筆數一致。',
        itemView: { fieldMode: (args) => isPartnerUiSession(args) ? 'read' : 'edit' },
      },
    }),
    sortOrder: integer({
      label: '顯示順序',
      defaultValue: 0,
      ui: {
        description:
          '選項顯示排序（由小到大）。前台發文時依設定順序帶入索引；數字越小越前面，不隨票數變動。',
      },
    }),
  },
  ui: {
    label: '投票選項',
    /** 供 Poll.options（cards / inline）顯示卡片標題與連結文字 */
    labelField: 'text',
    listView: {
      initialColumns: ['text', 'sortOrder', 'poll', 'voteCount'],
      initialSort: { field: 'sortOrder', direction: 'ASC' },
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor, partner),
      update: allowRoles(admin, moderator, editor, partner),
      create: allowRoles(admin, moderator, editor, partner),
      delete: allowRoles(admin, editor),
    },
    filter: {
      // [AC-004] 非 CMS query 只回傳有可見父層 Poll（及其 Post）的選項，防止草稿選項洩漏。
      query: ({ context }) => {
        if (isPartnerSession(context)) {
          return getPartnerMemberId(context).then((memberId) =>
            memberId == null ? false : { poll: { member: { id: { equals: memberId } } } }
          )
        }
        if (canReadTrustedBackendContent(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        return {
          poll: {
            post: buildPostVisibilityWhere(memberId),
          },
        }
      },
      update: ({ context }) => {
        if (!isPartnerSession(context)) return true
        return getPartnerMemberId(context).then((memberId) =>
          memberId == null ? false : { poll: { member: { id: { equals: memberId } } } }
        )
      },
    },
  },
  hooks: {
    resolveInput: async ({ resolvedData, operation, context }) => {
      if (isPartnerSession(context)) {
        const data = { ...resolvedData }
        delete data.voteCount
        const pollId = connectedId(data.poll)
        if (operation === 'create' && pollId == null) throw new Error('投票選項必須關聯投票')
        if (pollId != null && !(await partnerOwnsPoll(context, pollId))) {
          throw new Error('Partner 只能關聯自己的投票')
        }
        if (operation === 'update') delete data.poll
        return data
      }
      if (operation === 'update') {
        return applyPollOptionUpdateTranslationOnly(
          resolvedData as Record<string, unknown>
        ) as typeof resolvedData
      }
      return resolvedData
    },
    afterOperation: createMessageServicesTranslationHook('pollOption'),
  },
})

export default utils.addTrackingFields(listConfigurations)
