import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, integer, relationship, timestamp } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

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
        description: '此投票所依附的文章（一對一）。',
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
        hideCreate: false,
        displayMode: 'cards',
        /** 卡片上顯示的 PollOption 欄位（見 Relationship field cards） */
        cardFields: ['text', 'voteCount'],
        linkToItem: true,
        /** 在投票項目頁內直接新增選項（不需另開 PollOption 建立頁） */
        inlineCreate: {
          fields: [
            'text',
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
          '此投票總票數；可與 PollVote 對照或手動調整。',
      },
    }),
    member: relationship({
      ref: 'Member.memberPolls',
      many: false,
      label: '使用者',
      ui: {
        description: '選填：關聯前台會員（Member）。',
      },
    }),
  },
  ui: {
    label: '投票活動',
    labelField: 'title',
    listView: {
      initialColumns: ['title', 'post', 'member', 'totalVotes', 'expiresAt'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },
  hooks: {
    afterOperation: createMessageServicesTranslationHook('poll'),
  },
})

export default utils.addTrackingFields(listConfigurations)
