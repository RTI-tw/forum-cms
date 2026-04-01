import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, integer, relationship } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

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
      },
    }),
  },
  ui: {
    label: '投票選項',
    /** 供 Poll.options（cards / inline）顯示卡片標題與連結文字 */
    labelField: 'text',
    listView: {
      initialColumns: ['text', 'poll', 'voteCount'],
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
    afterOperation: createMessageServicesTranslationHook('pollOption'),
  },
})

export default utils.addTrackingFields(listConfigurations)
