import { utils } from '@mirrormedia/lilith-core'
import { allowAdminOnly } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship, checkbox, select, timestamp } from '@keystone-6/core/fields'
import { nationalitySelectOptions } from '../utils/countries-data'
import { computeIsCompleteProfile } from '../utils/member-profile'

const hiddenFromCmsUi = {
  createView: { fieldMode: 'hidden' as const },
  itemView: { fieldMode: 'hidden' as const },
  listView: { fieldMode: 'hidden' as const },
}

const INACTIVE_PREFIX = 'inactive: '
const DELETED_PREFIX = 'DELETED-'

function markInactiveValue(value?: string | null, fallback = '') {
  const normalized = value ?? fallback
  return `${INACTIVE_PREFIX}${normalized}`
}

function markDeletedUniqueValue(memberId: unknown, value?: string | null) {
  const normalizedMemberId = String(memberId ?? '').trim()
  if (!normalizedMemberId) {
    throw new Error('Member id is required to mark deleted unique values')
  }

  return `${DELETED_PREFIX}${normalizedMemberId}-${value ?? ''}`
}

function restoreInactiveEmail(email?: string | null, firebaseId?: string | null) {
  const rawEmail = email ?? ''
  const rawFirebaseId = firebaseId ?? ''
  const restoredFirebaseId = rawFirebaseId.replace(/^inactive: /, '')
  const restoredEmail = rawEmail
    .replace(/^inactive: /, '')
    .replace(`  ${restoredFirebaseId}`, '')

  return {
    email: restoredEmail,
    firebaseId: restoredFirebaseId,
  }
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
        { label: '啟用', value: 'active' },
        { label: '停用', value: 'inactive' },
        { label: '停權', value: 'banned' },
        { label: '已刪帳', value: 'deleted' },
      ],
      defaultValue: 'inactive',
      validation: { isRequired: true },
      ui: {
        description:
          '啟用：正常使用；停用：會員待完成註冊；停權：禁止登入且保留原 email；已刪帳：禁止登入並釋放 email、Firebase ID、自訂 ID 供重新註冊。',
      },
    }),
    verified: checkbox({
      label: '已驗證',
      defaultValue: false,
    }),
    isCompleteProfile: checkbox({
      label: '已完成個人資料',
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
      initialColumns: [
        'nickname',
        'email',
        'status',
        'isCompleteProfile',
        'nationality',
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
    resolveInput: ({ resolvedData, item }) => {
      const typedItem = item as any
      if (!typedItem) {
        const nextFirebaseId = resolvedData.firebaseId
        const nextCustomId = resolvedData.customId
        const nextName = resolvedData.name
        const nextNickname = resolvedData.nickname
        resolvedData.isCompleteProfile = computeIsCompleteProfile({
          firebaseId:
            typeof nextFirebaseId === 'string' ? nextFirebaseId : undefined,
          customId: typeof nextCustomId === 'string' ? nextCustomId : undefined,
          name: typeof nextName === 'string' ? nextName : undefined,
          nickname:
            typeof nextNickname === 'string' ? nextNickname : undefined,
        })
        return resolvedData
      }
      const prevStatus = typedItem?.status ?? 'active'
      const nextStatus =
        resolvedData.status !== undefined ? resolvedData.status : prevStatus

      if (prevStatus !== 'deleted' && nextStatus === 'deleted') {
        const memberId = typedItem?.id
        resolvedData.email = markDeletedUniqueValue(
          memberId,
          typedItem?.email ?? resolvedData.email
        )
        resolvedData.firebaseId = markDeletedUniqueValue(
          memberId,
          typedItem?.firebaseId ?? resolvedData.firebaseId
        )
        resolvedData.customId = markDeletedUniqueValue(
          memberId,
          typedItem?.customId ?? resolvedData.customId
        )
      } else if (prevStatus !== 'inactive' && nextStatus === 'inactive') {
        const srcEmail = typedItem?.email ?? resolvedData.email
        const srcFirebase = typedItem?.firebaseId ?? resolvedData.firebaseId
        resolvedData.email = `${markInactiveValue(srcEmail)}  ${srcFirebase ?? ''}`
        resolvedData.firebaseId = markInactiveValue(srcFirebase)
      } else if (prevStatus === 'inactive' && nextStatus !== 'inactive') {
        const srcEmail = typedItem?.email ?? resolvedData.email
        const srcFirebase = typedItem?.firebaseId ?? resolvedData.firebaseId
        const restored = restoreInactiveEmail(srcEmail, srcFirebase)
        resolvedData.firebaseId = restored.firebaseId
        resolvedData.email = restored.email
      }

      resolvedData.isCompleteProfile = computeIsCompleteProfile({
        firebaseId:
          typeof (resolvedData.firebaseId ?? typedItem?.firebaseId) === 'string'
            ? (resolvedData.firebaseId ?? typedItem?.firebaseId)
            : undefined,
        customId:
          typeof (resolvedData.customId ?? typedItem?.customId) === 'string'
            ? (resolvedData.customId ?? typedItem?.customId)
            : undefined,
        name:
          typeof (resolvedData.name ?? typedItem?.name) === 'string'
            ? (resolvedData.name ?? typedItem?.name)
            : undefined,
        nickname:
          typeof (resolvedData.nickname ?? typedItem?.nickname) === 'string'
            ? (resolvedData.nickname ?? typedItem?.nickname)
            : undefined,
      })

      return resolvedData
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
