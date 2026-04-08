import { utils } from '@mirrormedia/lilith-core'
import { allowAdminOnly } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship, select } from '@keystone-6/core/fields'

const listConfigurations = list({
  fields: {
    displayName: text({
      label: '顯示名稱',
      validation: { isRequired: true },
      isIndexed: 'unique',
    }),
    nationalFlag: relationship({
      label: '國旗',
      ref: 'Photo',
    }),
    status: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: '啟用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
      defaultValue: 'active',
      validation: { isRequired: true },
    }),
    members: relationship({
      label: '會員',
      ref: 'Member.nationality',
      many: true,
    }),
  },
  ui: {
    label: '國籍',
    labelField: 'displayName',
    listView: {
      initialColumns: ['displayName', 'status', 'nationalFlag'],
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
})

export default utils.addTrackingFields(listConfigurations)
