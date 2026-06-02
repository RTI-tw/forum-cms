import { list } from '@keystone-6/core'
import { text, relationship, select, integer } from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'

const listConfigurations = list({
  fields: {
    title: text({
      label: '圖片名稱 Title',
      ui: {
        description: '內部辨識用，不對外顯示',
      },
      validation: { isRequired: true },
    }),
    image: relationship({
      ref: 'Photo',
      many: false,
      label: '圖片 Image',
      ui: {
        description:
          '可從圖片庫挑選現有圖片，或直接上傳新圖片（上傳後會存入圖片庫）。',
        displayMode: 'cards',
        cardFields: ['name', 'urlOriginal', 'altText'],
        inlineConnect: true,
        inlineCreate: { fields: ['name', 'file', 'altText'] },
        inlineEdit: { fields: ['name', 'file', 'altText'] },
        linkToItem: true,
      },
    }),
    linkUrl: text({
      label: '連結網址 LinkUrl',
      ui: {
        description: '使用者點擊圖片後導向的目標網址',
      },
    }),
    sortOrder: integer({
      label: '顯示順序 SortOrder',
      defaultValue: 0,
      ui: {
        description: '數字越小越靠前。',
      },
    }),
    status: select({
      label: '狀態 Status',
      type: 'enum',
      options: [
        { label: '草稿 Draft', value: 'draft' },
        { label: '上架 Active', value: 'active' },
        { label: '下架 Inactive', value: 'inactive' },
      ],
      defaultValue: 'draft',
      validation: { isRequired: true },
    }),
  },
  ui: {
    label: '首頁圖片區（熱門投票下方）',
    listView: {
      initialColumns: ['title', 'status', 'sortOrder', 'linkUrl'],
      initialSort: { field: 'sortOrder', direction: 'ASC' },
      pageSize: 50,
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
  graphql: {
    cacheHint: { maxAge: 1200, scope: 'PUBLIC' },
  },
})

export default utils.addTrackingFields(listConfigurations)
