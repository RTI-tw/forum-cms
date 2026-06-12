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
          '決定此廣告的內容類型。新增頁會列出所有格式的欄位，請依所選格式填寫對應欄位即可；儲存後，編輯頁只會顯示所選格式的欄位。',
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
    validateInput: async ({
      resolvedData,
      item,
      operation,
      context,
      addValidationError,
    }) => {
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

      // 依格式必填：僅於「上架（Active）」時強制；草稿/下架可不完整。
      // 以「本次送出值優先、否則沿用既有 item 值」計算有效狀態與內容。
      const prev = (item ?? {}) as Record<string, unknown>
      const status = (resolvedData.status ?? prev.status) as string | undefined
      if (status !== 'active') return
      const format = (resolvedData.format ??
        prev.format ??
        'single_image') as AdFormat

      const imageRel = resolvedData.image as
        | { connect?: unknown; disconnect?: unknown }
        | undefined
      const hasImage = imageRel
        ? Boolean(imageRel.connect) && !imageRel.disconnect
        : Boolean(prev.imageId)

      const videoUrl = (resolvedData.videoUrl ?? prev.videoUrl) as
        | string
        | undefined
      const hasVideoUrl =
        typeof videoUrl === 'string' && videoUrl.trim() !== ''
      const hasVideoFile =
        resolvedData.videoFile !== undefined
          ? Boolean(resolvedData.videoFile)
          : Boolean(prev.videoFile_filename)

      const adCode = (resolvedData.adCode ?? prev.adCode) as string | undefined
      const hasAdCode = typeof adCode === 'string' && adCode.trim() !== ''

      if (format === 'single_image' && !hasImage) {
        addValidationError('上架（Active）前，「單張靜態圖」格式需選擇廣告圖片。')
      } else if (format === 'video' && !hasVideoUrl && !hasVideoFile) {
        addValidationError(
          '上架（Active）前，「動態影像」格式需填寫影片網址或上傳影片檔。'
        )
      } else if (format === 'third_party' && !hasAdCode) {
        addValidationError(
          '上架（Active）前，「第三方廣告代碼」格式需填寫廣告代碼。'
        )
      } else if (format === 'carousel') {
        // 輪播需至少一張：既有 slides 數 + 本次新增/連結（採寬鬆估計）。
        let existing = 0
        if (operation === 'update' && prev.id != null) {
          existing = await context.prisma.adSlide.count({
            where: { adId: Number(prev.id) },
          })
        }
        const slidesRel = resolvedData.slides as
          | { connect?: unknown[]; create?: unknown[] }
          | undefined
        const adding =
          (slidesRel?.connect?.length ?? 0) + (slidesRel?.create?.length ?? 0)
        if (existing + adding < 1) {
          addValidationError(
            '上架（Active）前，「靜態圖輪播」格式需至少新增一張輪播圖片。'
          )
        }
      }
    },
  },
  graphql: {
    cacheHint: { maxAge: 1200, scope: 'PUBLIC' },
  },
})

export default utils.addTrackingFields(listConfigurations)
