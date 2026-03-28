import { list } from '@keystone-6/core'
import {
  text,
  relationship,
  select,
  checkbox,
  integer,
} from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'

const { allowRoles, admin, moderator, editor } = utils.accessControl

const listConfigurations = list({
  fields: {
    name: text({
      label: '名稱',
      validation: { isRequired: true },
    }),
    showOnHomepage: checkbox({
      label: '是否出現在首頁（時事新聞下方）',
      defaultValue: false,
    }),
    showOnHomepageDeepTopic: checkbox({
      label: '是否出現在首頁深度專題下方',
      defaultValue: false,
    }),
    image: relationship({
      ref: 'Photo',
      many: false,
      label: '圖片',
    }),
    imageUrl: text({
      label: '圖片連結',
      validation: { isRequired: true },
    }),
    state: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: '啟用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
      defaultValue: 'inactive',
      validation: { isRequired: true },
    }),
    sortOrder: integer({
      label: '排序',
      validation: { isRequired: true },
    }),
  },
  ui: {
    label: '廣告',
    listView: {
      initialColumns: ['name', 'state', 'showOnHomepage', 'sortOrder'],
      pageSize: 50,
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },
  graphql: {
    cacheHint: { maxAge: 1200, scope: 'PUBLIC' },
  },
})

export default utils.addTrackingFields(listConfigurations)
