import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, select } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

const listConfigurations = list({
  db: {
    map: 'Content',
  },
  fields: {
    identifier: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: '識別碼',
    }),
    title: text({
      label: '標題',
      ui: { displayMode: 'textarea' },
    }),
    title_zh: text({
      label: '標題（中文）',
      ui: { displayMode: 'textarea' },
    }),
    title_en: text({
      label: '標題（英文）',
      ui: { displayMode: 'textarea' },
    }),
    title_vi: text({
      label: '標題（越南文）',
      ui: { displayMode: 'textarea' },
    }),
    title_id: text({
      label: '標題（印尼文）',
      ui: { displayMode: 'textarea' },
    }),
    title_th: text({
      label: '標題（泰文）',
      ui: { displayMode: 'textarea' },
    }),
    content: text({
      label: '原文內容',
      ui: { displayMode: 'textarea' },
    }),
    language: select({
      label: '原始語言',
      type: 'enum',
      options: [
        { label: '中文', value: 'zh' },
        { label: 'English', value: 'en' },
        { label: 'Tiếng Việt', value: 'vi' },
        { label: 'Bahasa Indonesia', value: 'id' },
        { label: 'ภาษาไทย', value: 'th' },
      ],
    }),
    content_zh: text({
      label: '內容（中文）',
      ui: { displayMode: 'textarea' },
    }),
    content_en: text({
      label: '內容（英文）',
      ui: { displayMode: 'textarea' },
    }),
    content_vi: text({
      label: '內容（越南文）',
      ui: { displayMode: 'textarea' },
    }),
    content_id: text({
      label: '內容（印尼文）',
      ui: { displayMode: 'textarea' },
    }),
    content_th: text({
      label: '內容（泰文）',
      ui: { displayMode: 'textarea' },
    }),
  },
  ui: {
    label: '靜態頁面',
    listView: {
      initialColumns: ['identifier', 'title', 'language'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin),
      create: allowRoles(admin),
      delete: allowRoles(admin),
    },
  },
  hooks: {
    afterOperation: createMessageServicesTranslationHook('content'),
  },
})

export default utils.addTrackingFields(listConfigurations)
