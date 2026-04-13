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
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
    filter: {
      query: ({ context }) => {
        if (isCmsRequest(context)) return true
        const memberId = getAuthenticatedMemberId(context)
        return {
          post: buildPostVisibilityWhere(memberId),
        }
      },
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
