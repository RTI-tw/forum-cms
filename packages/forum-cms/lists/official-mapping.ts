import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship } from '@keystone-6/core/fields'

const listConfigurations = list({
  fields: {
    cmsUser: relationship({
      ref: 'User.officialAccounts',
      many: false,
      label: 'CMS 使用者',
    }),
    officialMember: relationship({
      ref: 'Member',
      many: false,
      label: '前台官方帳號',
    }),
    note: text({ label: '備註' }),
  },
  ui: {
    label: '官方帳號授權',
    listView: {
      initialColumns: ['cmsUser', 'officialMember', 'note'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, editor),
      update: allowRoles(admin, editor),
      create: allowRoles(admin, editor),
      delete: allowRoles(admin, editor),
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
