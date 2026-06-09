import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { relationship } from '@keystone-6/core/fields'
import {
  buildPostVisibilityWhere,
  getAuthenticatedMemberId,
  isCmsRequest,
} from '../utils/post-visibility'

const listConfigurations = list({
  fields: {
    post: relationship({
      ref: 'Post',
      many: false,
      label: '文章',
    }),
    member: relationship({
      ref: 'Member',
      many: false,
      label: '會員',
    }),
  },
  ui: {
    label: '書籤',
    listView: {
      initialColumns: ['post', 'member'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
    filter: {
      // [AC-002] 非 CMS query 限制只能看自己的書籤，且拒絕未登入存取。
      query: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) return false
        return {
          member: { id: { equals: memberId } },
          post: buildPostVisibilityWhere(memberId),
        }
      },
      // [AC-007] 非 CMS update/delete 只允許操作自己的書籤。
      update: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) return false
        return { member: { id: { equals: memberId } } }
      },
      delete: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) return false
        return { member: { id: { equals: memberId } } }
      },
    },
  },
  hooks: {
    // [AC-007] 非 CMS create 強制綁定 member 為已驗證會員，忽略用戶端傳入。
    resolveInput: ({ resolvedData, operation, context }) => {
      if (isCmsRequest(context)) return resolvedData
      const data = { ...resolvedData }
      if (operation === 'create') {
        const memberId = getAuthenticatedMemberId(context)
        if (!memberId) {
          throw new Error('書籤操作需要有效的會員登入狀態')
        }
        data.member = { connect: { id: memberId } }
      }
      return data
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
