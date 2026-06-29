import { list } from '@keystone-6/core'
import { text, relationship, integer } from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { isSafeLinkUrl } from '../utils/url-safety'
import {
  ADS_EXPORT_ENDPOINT,
  createCronJsonExportHook,
  shouldTriggerAdSlideJsonExport,
} from '../utils/cron-json-export-hook'

const formatAwareRelationshipView =
  './lists/views/ad-format-aware-field/relationship'

const adSlideJsonExportAfterOperation = createCronJsonExportHook({
  label: 'ad slide json export',
  endpoints: [ADS_EXPORT_ENDPOINT],
  shouldTrigger: shouldTriggerAdSlideJsonExport,
})

/**
 * 廣告輪播單格（AdSlide）：隸屬於某個「靜態圖輪播」格式的廣告（Ad.slides）。
 * 每一格有獨立的圖片、點擊連結與排序。
 */
const listConfigurations = list({
  fields: {
    ad: relationship({
      ref: 'Ad.slides',
      many: false,
      label: '所屬廣告 Ad',
      ui: {
        description: '此輪播格所屬的廣告（格式須為「靜態圖輪播」）。',
        hideCreate: true,
      },
    }),
    image: relationship({
      ref: 'Photo',
      many: false,
      label: '桌機廣告圖片 Desktop image',
      ui: {
        description:
          '可從圖片庫挑選現有桌機版廣告圖片，或直接上傳新圖片（上傳後會存入圖片庫）。',
        views: formatAwareRelationshipView,
        displayMode: 'cards',
        cardFields: ['name', 'urlOriginal', 'altText'],
        inlineConnect: true,
        inlineCreate: { fields: ['name', 'file', 'altText'] },
        inlineEdit: { fields: ['name', 'file', 'altText'] },
        linkToItem: true,
      },
    }),
    mobileImage: relationship({
      ref: 'Photo',
      many: false,
      label: '手機版廣告圖片 Mobile image',
      ui: {
        description:
          '可從圖片庫挑選現有手機版廣告圖片，或直接上傳新圖片（上傳後會存入圖片庫）。',
        views: formatAwareRelationshipView,
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
        description: '使用者點擊此格圖片後導向的目標網址。',
      },
    }),
    sortOrder: integer({
      label: '顯示順序 SortOrder',
      defaultValue: 0,
      ui: {
        description: '數字越小越靠前。',
      },
    }),
  },
  ui: {
    label: '廣告輪播格',
    listView: {
      initialColumns: ['ad', 'image', 'sortOrder', 'linkUrl'],
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
  hooks: {
    afterOperation: adSlideJsonExportAfterOperation,
    validateInput: ({ resolvedData, operation, addValidationError }) => {
      if (operation !== 'create' && operation !== 'update') return
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
