import { list } from '@keystone-6/core'
import {
  text,
  relationship,
  select,
  timestamp,
  file,
} from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { isSafeLinkUrl } from '../utils/url-safety'

/**
 * 廣告格式：
 * - single_image  單張靜態圖（沿用 image 欄位）
 * - carousel      靜態圖輪播（多張，使用 AdSlide 子清單）
 * - video         動態影像（外部 videoUrl 或上傳 videoFile）
 * - third_party   第三方廣告代碼（如 Google Ad Manager / HTML script tag）
 */
type AdFormat = 'single_image' | 'carousel' | 'video' | 'third_party'

/** 依廣告格式，在 itemView 顯示/隱藏對應欄位（依已儲存的 item.format 判斷）。 */
function visibleForFormat(...formats: AdFormat[]) {
  return ({ item }: { item?: Record<string, unknown> }) =>
    formats.includes(item?.format as AdFormat) ? 'edit' : 'hidden'
}

const listConfigurations = list({
  fields: {
    title: text({
      label: '廣告名稱 Title',
      ui: {
        description: '內部辨識用，不對外顯示',
      },
      validation: { isRequired: true },
    }),
    format: select({
      label: '廣告格式 Format',
      type: 'enum',
      options: [
        { label: '單張靜態圖 Single image', value: 'single_image' },
        { label: '靜態圖輪播 Image carousel', value: 'carousel' },
        { label: '動態影像 Video', value: 'video' },
        { label: '第三方廣告代碼 Third-party tag', value: 'third_party' },
      ],
      defaultValue: 'single_image',
      validation: { isRequired: true },
      ui: {
        description:
          '決定下方要填寫哪些欄位；儲存後對應欄位才會顯示。新增時請先選好格式並儲存。',
      },
    }),
    startAt: timestamp({
      label: '開始時間 StartAt',
      db: { isNullable: true },
    }),
    endAt: timestamp({
      label: '結束時間 EndAt',
      db: { isNullable: true },
    }),
    status: select({
      label: '狀態 Status',
      type: 'enum',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Finished', value: 'finished' },
      ],
      defaultValue: 'draft',
      validation: { isRequired: true },
    }),
    // --- 單張靜態圖 ---
    image: relationship({
      ref: 'Photo',
      many: false,
      label: '廣告圖片 Image（單張靜態圖）',
      ui: {
        description:
          '格式為「單張靜態圖」時使用。建議素材：桌機 728×90（超級橫幅）、手機 300×250（中矩形）。',
        itemView: { fieldMode: visibleForFormat('single_image') },
      },
    }),
    // --- 靜態圖輪播 ---
    slides: relationship({
      ref: 'AdSlide.ad',
      many: true,
      label: '輪播圖片 Slides（靜態圖輪播）',
      ui: {
        description:
          '格式為「靜態圖輪播」時使用。每一格可設定獨立圖片、連結與顯示順序。',
        displayMode: 'cards',
        cardFields: ['image', 'linkUrl', 'sortOrder'],
        inlineCreate: { fields: ['image', 'linkUrl', 'sortOrder'] },
        inlineEdit: { fields: ['image', 'linkUrl', 'sortOrder'] },
        inlineConnect: true,
        linkToItem: true,
        removeMode: 'disconnect',
        itemView: { fieldMode: visibleForFormat('carousel') },
      },
    }),
    // --- 動態影像 ---
    videoUrl: text({
      label: '影片網址 VideoUrl（動態影像）',
      ui: {
        description:
          '格式為「動態影像」時使用；外部影片連結（YouTube / Vimeo / mp4 等 http/https 網址）。',
        itemView: { fieldMode: visibleForFormat('video') },
      },
    }),
    videoFile: file({
      storage: 'files',
      label: '影片檔 VideoFile（動態影像）',
      ui: {
        description:
          '格式為「動態影像」時使用；可改為上傳影片檔。注意：伺服器上傳上限為 20MB，較長的影片請改用「影片網址」。',
        itemView: { fieldMode: visibleForFormat('video') },
      },
    }),
    // --- 第三方廣告代碼 ---
    adCode: text({
      label: '廣告代碼 AdCode（第三方）',
      ui: {
        displayMode: 'textarea',
        description:
          '格式為「第三方廣告代碼」時使用；貼上廣告商提供的 HTML / script tag（例如 Google Ad Manager）。此內容會原樣輸出至前台，請務必只貼信任來源的代碼。',
        itemView: { fieldMode: visibleForFormat('third_party') },
      },
    }),
    // --- 共用：點擊導向 ---
    linkUrl: text({
      label: '廣告網址 LinkUrl',
      ui: {
        description:
          '使用者點擊後導向的目標網址（單張靜態圖／動態影像適用；輪播請於各格設定）。',
      },
    }),
  },
  ui: {
    label: '廣告',
    listView: {
      initialColumns: ['title', 'format', 'status', 'startAt', 'endAt'],
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
    validateInput: ({ resolvedData, item, operation, addValidationError }) => {
      if (operation !== 'create' && operation !== 'update') return

      // URL scheme 安全性：只要帶值就檢查（縱深防禦 stored XSS）。
      const urlChecks: Array<[unknown, string]> = [
        [resolvedData.linkUrl, '廣告網址'],
        [resolvedData.videoUrl, '影片網址'],
      ]
      for (const [value, label] of urlChecks) {
        if (typeof value === 'string' && !isSafeLinkUrl(value)) {
          addValidationError(
            `${label}僅允許 http/https 絕對網址或以 / 開頭的站內路徑。`
          )
        }
      }

      // 依格式檢查必要欄位（僅於建立時強制，避免後台局部更新時誤報）。
      if (operation !== 'create') return
      void item
      const format = (resolvedData.format ?? 'single_image') as AdFormat

      const hasImage = Boolean(
        (resolvedData.image as { connect?: unknown } | undefined)?.connect
      )
      const hasVideoUrl =
        typeof resolvedData.videoUrl === 'string' &&
        resolvedData.videoUrl.trim() !== ''
      const hasVideoFile = Boolean(resolvedData.videoFile)
      const hasAdCode =
        typeof resolvedData.adCode === 'string' &&
        resolvedData.adCode.trim() !== ''

      if (format === 'single_image' && !hasImage) {
        addValidationError('格式為「單張靜態圖」時，請選擇廣告圖片。')
      }
      if (format === 'video' && !hasVideoUrl && !hasVideoFile) {
        addValidationError('格式為「動態影像」時，請填寫影片網址或上傳影片檔。')
      }
      if (format === 'third_party' && !hasAdCode) {
        addValidationError('格式為「第三方廣告代碼」時，請填寫廣告代碼。')
      }
      // carousel：輪播格（slides）於廣告建立後再個別新增，故此處不強制。
    },
  },
  graphql: {
    cacheHint: { maxAge: 1200, scope: 'PUBLIC' },
  },
})

export default utils.addTrackingFields(listConfigurations)
