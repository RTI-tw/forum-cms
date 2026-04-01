import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, checkbox, select } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

/**
 * 關鍵字（原文）唯一；五國翻譯 word_zh … word_th 可由 message-services 依原文同步。
 * language 與主題分類相同，標示「原文」所屬語言。
 */
const listConfigurations = list({
  fields: {
    word: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: '關鍵字（原文）',
    }),
    language: select({
      label: '原始語言',
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: '中文', value: 'zh' },
        { label: 'English', value: 'en' },
        { label: 'Tiếng Việt', value: 'vi' },
        { label: 'Bahasa Indonesia', value: 'id' },
        { label: 'ภาษาไทย', value: 'th' },
      ],
      defaultValue: 'zh',
    }),
    word_zh: text({
      label: '關鍵字（中文）',
      ui: {
        description: '五國語言翻譯欄位之一；可透過 message-services 依原文同步。',
      },
    }),
    word_en: text({ label: '關鍵字（英文）' }),
    word_vi: text({ label: '關鍵字（越南文）' }),
    word_id: text({ label: '關鍵字（印尼文）' }),
    word_th: text({ label: '關鍵字（泰文）' }),
    note: text({ label: '備註' }),
    isEnabled: checkbox({
      label: '啟用',
      defaultValue: true,
    }),
  },
  ui: {
    label: '禁用關鍵字',
    listView: {
      initialColumns: ['word', 'language', 'isEnabled', 'note'],
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
    afterOperation: createMessageServicesTranslationHook('forbiddenKeyword'),
  },
})

export default utils.addTrackingFields(listConfigurations)
