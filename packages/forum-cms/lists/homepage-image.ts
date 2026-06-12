import { list } from '@keystone-6/core'
import { text, relationship, select, integer } from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { isCmsRequest } from '../utils/post-visibility'
import { isSafeLinkUrl } from '../utils/url-safety'

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
    /**
     * ACCESS_CONTROL_STRATEGY 非 `cms`（gql、preview、api）時，公開 API 僅能讀到
     * `status: active`，避免暴露草稿（draft）與已下架（inactive）的圖片資料。
     * CMS 登入者仍可查詢所有狀態以利後台管理。
     */
    filter: {
      query: ({ context }) => {
        if (isCmsRequest(context)) {
          return true
        }
        return { status: { equals: 'active' } }
      },
    },
  },
  hooks: {
    validateInput: ({ resolvedData, operation, addValidationError }) => {
      if (operation !== 'create' && operation !== 'update') return
      // update 時 Keystone 僅帶入有變更的欄位；未出現代表沿用原值。
      const linkUrl = resolvedData.linkUrl
      if (typeof linkUrl === 'string' && !isSafeLinkUrl(linkUrl)) {
        addValidationError(
          '連結網址僅允許 http/https 絕對網址或以 / 開頭的站內路徑。'
        )
      }
    },
  },
  graphql: {
    cacheHint: { maxAge: 1200, scope: 'PUBLIC' },
  },
})

export default utils.addTrackingFields(listConfigurations)
