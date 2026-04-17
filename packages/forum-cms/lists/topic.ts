import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list, graphql } from '@keystone-6/core'
import { text, integer, relationship, select, virtual } from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

const listConfigurations = list({
  fields: {
    name: text({
      validation: { isRequired: true },
      label: '名稱（原文）',
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
    name_zh: text({ label: '名稱（中文）' }),
    name_en: text({ label: '名稱（英文）' }),
    name_vi: text({ label: '名稱（越南文）' }),
    name_id: text({ label: '名稱（印尼文）' }),
    name_th: text({ label: '名稱（泰文）' }),
    slug: text({
      isIndexed: 'unique',
      validation: { isRequired: true },
      label: '網址代碼',
    }),
    sortOrder: integer({
      label: '排序',
      defaultValue: 0,
    }),
    state: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: '啟用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
      defaultValue: 'active',
    }),
    description: text({
      label: '描述',
      ui: { displayMode: 'textarea' },
    }),
    posts: relationship({
      ref: 'Post.topics',
      many: true,
      label: '文章',
    }),
    todayPostsCount: virtual({
      label: '今日新增文章數',
      field: graphql.field({
        type: graphql.Int,
        resolve: async (item, _args, context) => {
          const topic = item as { id?: number | string | null }
          const topicId = Number(topic.id)
          if (!Number.isFinite(topicId)) return 0

          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)

          return context.db.Post.count({
            where: {
              createdAt: { gte: startOfToday.toISOString() },
              topics: { id: { equals: topicId } },
            },
          })
        },
      }),
      ui: {
        itemView: { fieldMode: 'read' },
        listView: { fieldMode: 'read' },
      },
    }),
  },
  ui: {
    label: '主題分類',
    listView: {
      initialColumns: ['name', 'slug', 'state', 'todayPostsCount', 'sortOrder'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
  },
  hooks: {
    afterOperation: createMessageServicesTranslationHook('topic'),
  },
})

export default utils.addTrackingFields(listConfigurations)
