import { utils } from '@mirrormedia/lilith-core'
import { allowAdminOnly } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, select, relationship, integer } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'
import { createContentJsonExportHook } from '../utils/content-json-export-hook'

const translationAfterContent = createMessageServicesTranslationHook('content')
const exportContentJsonAfterOperation = createContentJsonExportHook()

const listConfigurations = list({
  db: {
    map: 'Content',
  },
  fields: {
    identifier: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: '網址名稱',
      ui: {
        description:
          '對應前台靜態頁路徑或網址片段（原為識別碼；請使用英數、連字號等）。',
      },
    }),
    sortOrder: integer({
      label: '排序',
      defaultValue: 0,
      validation: { isRequired: true, min: 0 },
      ui: {
        description: '數字越小越前面；供 CMS 列表或前台排序使用。',
      },
    }),
    status: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Draft', value: 'draft' },
      ],
      defaultValue: 'published',
      validation: { isRequired: true },
      ui: {
        description: 'Published：可供前台使用；Draft：草稿暫不發布。',
      },
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
    photos: relationship({
      ref: 'Photo.staticContents',
      many: true,
      label: '圖片',
      ui: {
        description: '此靜態頁使用的圖片；亦可在「圖片」單筆頁連結至此頁。',
        displayMode: 'cards',
        cardFields: ['name', 'urlOriginal', 'sortOrder'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
    videos: relationship({
      ref: 'Video.staticContents',
      many: true,
      label: '影片',
      ui: {
        description: '此靜態頁使用的影片；亦可在「影片」單筆頁連結至此頁。',
        displayMode: 'cards',
        cardFields: ['url', 'coverImage'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
  },
  ui: {
    label: '靜態頁面',
    listView: {
      initialColumns: [
        'identifier',
        'sortOrder',
        'status',
        'title',
        'language',
        'photos',
        'videos',
      ],
    },
  },
  access: {
    operation: {
      query: allowAdminOnly(),
      update: allowAdminOnly(),
      create: allowAdminOnly(),
      delete: allowAdminOnly(),
    },
  },
  hooks: {
    afterOperation: async (args) => {
      await translationAfterContent(args)
      await exportContentJsonAfterOperation(args)
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
