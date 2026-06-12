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
      // [AC-010] query 保留 editor 查閱；mutation 限制為 admin only，
      // 防止 editor 自行建立 mapping 以提升審核權限。
      query:   allowRoles(admin, editor),
      update:  allowRoles(admin),
      create:  allowRoles(admin),
      delete:  allowRoles(admin),
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
