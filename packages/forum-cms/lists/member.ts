import { utils } from '@mirrormedia/lilith-core'
import { allowAdminOnly } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship, checkbox, select, timestamp } from '@keystone-6/core/fields'
import { nationalitySelectOptions } from '../utils/countries-data'

const hiddenFromCmsUi = {
  createView: { fieldMode: 'hidden' as const },
  itemView: { fieldMode: 'hidden' as const },
  listView: { fieldMode: 'hidden' as const },
}

const listConfigurations = list({
  fields: {
    firebaseId: text({
      label: 'Firebase ID',
      validation: {
        isRequired: true,
      },
      isIndexed: 'unique',
    }),
    customId: text({
      label: '自訂 ID',
      validation: {
        isRequired: true,
      },
      isIndexed: 'unique',
    }),
    name: text({
      label: '姓名',
      validation: { isRequired: false },
      ui: hiddenFromCmsUi,
    }),
    nickname: text({ label: '暱稱', validation: { isRequired: true } }),
    intro: text({
      label: '介紹',
      validation: { isRequired: false },
      ui: hiddenFromCmsUi,
    }),
    avatar_image: relationship({
      label: '頭像圖片',
      ref: 'Photo',
    }),
    email: text({
      label: 'Email',
      validation: { isRequired: false },
      isFilterable: true,
      isIndexed: 'unique',
    }),
    status: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: '待完成資料', value: 'pending' },
        { label: '啟用', value: 'active' },
        { label: '停用', value: 'inactive' },
        { label: '停權', value: 'banned' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
      ui: {
        description:
          '待完成資料：尚未完成註冊；啟用：正常使用；停用：會員刪除帳號等；停權：後台停用該會員。',
      },
    }),
    verified: checkbox({
      label: '已驗證',
      defaultValue: false,
    }),
    comment: relationship({
      label: '留言',
      ref: 'Comment.member',
      many: true,
    }),
    posts: relationship({
      label: '文章',
      ref: 'Post.author',
      many: true,
    }),
    memberPolls: relationship({
      label: '投票活動',
      ref: 'Poll.member',
      many: true,
    }),
    reactions: relationship({
      label: '反應',
      ref: 'Reaction.member',
      many: true,
    }),
    isOfficial: checkbox({
      label: '官方帳號',
      defaultValue: false,
    }),
    joinDate: timestamp({
      label: '加入日期',
      defaultValue: { kind: 'now' },
    }),
    language: select({
      label: '語系',
      type: 'enum',
      options: [
        { label: '中文', value: 'zh' },
        { label: 'English (英文)', value: 'en' },
        { label: 'Tiếng Việt (越南文)', value: 'vi' },
        { label: 'Bahasa Indonesia (印尼文)', value: 'id' },
        { label: 'ภาษาไทย (泰文)', value: 'th' },
      ],
      defaultValue: 'zh',
    }),
    nationality: select({
      label: '國籍',
      type: 'enum',
      options: nationalitySelectOptions,
      db: { isNullable: true },
      validation: { isRequired: false },
      ui: {
        description:
          'ISO 3166-1 alpha-2；選項與五語名稱維護於 data/countries.json。',
      },
    }),
  },
  ui: {
    label: '會員',
    labelField: 'customId',
    listView: {
      initialColumns: ['nickname', 'email', 'status', 'nationality'],
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
    resolveInput: ({ resolvedData, item }) => {
      const typedItem = item as any
      const prevStatus = typedItem?.status ?? 'active'
      const nextStatus =
        resolvedData.status !== undefined ? resolvedData.status : prevStatus

      if (prevStatus !== 'inactive' && nextStatus === 'inactive') {
        const srcEmail = typedItem?.email ?? resolvedData.email
        const srcFirebase = typedItem?.firebaseId ?? resolvedData.firebaseId
        resolvedData.email = `inactive: ${srcEmail}  ${srcFirebase}`
        resolvedData.firebaseId = `inactive: ${srcFirebase}`
      } else if (prevStatus === 'inactive' && nextStatus === 'active') {
        const srcEmail = typedItem?.email ?? resolvedData.email
        const srcFirebase = typedItem?.firebaseId ?? resolvedData.firebaseId
        const newId = srcFirebase?.replace(/^inactive: /, '')
        resolvedData.firebaseId = newId
        resolvedData.email = srcEmail
          ?.replace(/^inactive: /, '')
          .replace(`  ${newId}`, '')
      }

      return resolvedData
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
