import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor, partner } from '../utils/access-control'
import { connectedId, getPartnerMemberId, isPartnerSession, isPartnerUiSession, partnerOwnsPost, requirePartnerMemberId } from '../utils/partner-access'
import { list } from '@keystone-6/core'
import { text, integer, relationship, timestamp } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'
import { applyPollUpdateTranslationOnly } from '../utils/cms-content-moderation'
import {
  buildPostVisibilityWhere,
  canReadTrustedBackendContent,
  getAuthenticatedMemberId,
} from '../utils/post-visibility'

/**
 * 欄位規格：
 * - 標題（原文）：最多 80 字；五國語言 title_zh … title_th
 * - 關聯文章、截止時間、投票選項、總票數
 * - 使用者：選填，關聯前台 Member
 */
const listConfigurations = list({
  fields: {
    title: text({
      validation: {
        isRequired: true,
        length: { max: 80 },
      },
      label: '標題（原文）',
      ui: {
        description: '最多 80 字（含空格與標點）。',
      },
    }),
    title_zh: text({
      label: '標題（中文）',
      ui: {
        description: '五國語言翻譯欄位之一；可透過 message-services 依原文同步。',
      },
    }),
    title_en: text({ label: '標題（英文）' }),
    title_vi: text({ label: '標題（越南文）' }),
    title_id: text({ label: '標題（印尼文）' }),
    title_th: text({ label: '標題（泰文）' }),
    post: relationship({
      ref: 'Post.poll',
      many: false,
      label: '關聯文章',
      ui: {
        description: '此投票所依附的文章；同一篇文章可關聯多個投票活動。',
      },
    }),
    expiresAt: timestamp({
      label: '截止時間',
      db: { isNullable: true },
      ui: {
        description: '投票截止時間；未填表示無截止時間（依前端／API 解讀）。',
      },
    }),
    options: relationship({
      ref: 'PollOption.poll',
      many: true,
      label: '投票選項',
      ui: {
        views: './lists/views/poll-options-sorted-relationship/index',
        hideCreate: false,
        displayMode: 'cards',
        /** 卡片上顯示的 PollOption 欄位（見 Relationship field cards） */
        cardFields: ['text', 'sortOrder', 'voteCount'],
        linkToItem: true,
        /** 在投票項目頁內直接新增選項（不需另開 PollOption 建立頁） */
        inlineCreate: {
          fields: [
            'text',
            'sortOrder',
            'text_zh',
            'text_en',
            'text_vi',
            'text_id',
            'text_th',
            'voteCount',
          ],
        },
        /** 在投票項目頁內直接編輯選項 */
        inlineEdit: {
          fields: [
            'text',
            'sortOrder',
            'text_zh',
            'text_en',
            'text_vi',
            'text_id',
            'text_th',
            'voteCount',
          ],
        },
        /** 不顯示「連結既有選項」；選項由此處新建為主 */
        inlineConnect: false,
        removeMode: 'disconnect',
      },
    }),
    totalVotes: integer({
      label: '總票數',
      defaultValue: 0,
      ui: {
        description:
          '由「投票紀錄」建立／變更／刪除時自動重算；與 PollVote 筆數一致（一人多選會計多筆）。',
      },
    }),
    voterCount: integer({
      label: '投票人數',
      defaultValue: 0,
      ui: {
        description:
          '不重複投票人數（一人多選只計一人）；由「投票紀錄」建立／變更／刪除時自動重算。單選時等於總票數。',
      },
    }),
    maxSelections: integer({
      label: '可複選上限',
      defaultValue: 1,
      validation: { isRequired: true, min: 1 },
      ui: {
        description: '每位會員最多可選幾項；1 = 單選（預設），設為 2 以上即為複選。',
      },
    }),
    member: relationship({
      ref: 'Member.memberPolls',
      many: false,
      label: '使用者',
      ui: {
        description: '選填：關聯前台會員（Member）。',
        createView: { fieldMode: (args) => isPartnerUiSession(args) ? 'hidden' : 'edit' },
        itemView: { fieldMode: (args) => isPartnerUiSession(args) ? 'read' : 'edit' },
      },
    }),
  },
  ui: {
    label: '投票活動',
    labelField: 'title',
    listView: {
      initialColumns: [
        'title',
        'post',
        'member',
        'totalVotes',
        'expiresAt',
        'createdAt',
      ],
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
      // [AC-004] 非 CMS query 只回傳有可見父層文章的 Poll，防止草稿/隱藏投票洩漏。
      query: ({ context }) => {
        if (isPartnerSession(context)) {
          return getPartnerMemberId(context).then((memberId) =>
            memberId == null ? false : { member: { id: { equals: memberId } } }
          )
        }
        if (canReadTrustedBackendContent(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        return {
          post: buildPostVisibilityWhere(memberId),
        }
      },
      update: ({ context }) => {
        if (!isPartnerSession(context)) return true
        return getPartnerMemberId(context).then((memberId) =>
          memberId == null ? false : { member: { id: { equals: memberId } } }
        )
      },
    },
  },
  hooks: {
    resolveInput: async ({ resolvedData, operation, context }) => {
      if (isPartnerSession(context)) {
        const data = { ...resolvedData }
        const memberId = await requirePartnerMemberId(context)
        if (operation === 'create') {
          data.member = { connect: { id: memberId } }
          data.totalVotes = 0
          data.voterCount = 0
        }
        if (operation === 'update') {
          delete data.member
          delete data.totalVotes
          delete data.voterCount
        }
        const postId = connectedId(data.post)
        if (postId != null && !(await partnerOwnsPost(context, postId))) {
          throw new Error('Partner 只能關聯自己的文章')
        }
        return data
      }
      if (operation === 'update') {
        return applyPollUpdateTranslationOnly(
          resolvedData as Record<string, unknown>
        ) as typeof resolvedData
      }
      return resolvedData
    },
    afterOperation: createMessageServicesTranslationHook('poll'),
  },
})

export default utils.addTrackingFields(listConfigurations)
