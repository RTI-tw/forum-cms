import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
  timestamp,
} from '@keystone-6/core/fields'
import { isSafeLinkUrl } from '../utils/url-safety'
import { syncEditorChoiceStateForEventId } from '../utils/sync-editor-choice-state'

const listConfigurations = list({
  fields: {
    title: text({
      label: '活動名稱',
      validation: { isRequired: true },
    }),
    slug: text({
      label: '活動網址名稱',
      validation: { isRequired: true },
      isIndexed: 'unique',
      ui: {
        description: '供前台活動頁與 API 查詢使用，建議使用英數與連字號。',
      },
    }),
    content: text({
      label: '活動內文',
      ui: {
        displayMode: 'textarea',
        views: './lists/views/markdown-editor/index',
        description: '支援 Markdown 編輯與即時預覽。',
      },
    }),
    images: relationship({
      ref: 'Photo.events',
      many: true,
      label: '圖片',
      ui: {
        description: '活動頁使用的圖片；可關聯多張圖片。',
        displayMode: 'cards',
        cardFields: ['name', 'urlOriginal', 'sortOrder'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
    externalLink: text({
      label: '活動連結',
      ui: {
        description: '選填；可放活動外部頁面、直播、地圖或其他相關連結。',
      },
    }),
    status: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: 'Draft（草稿）', value: 'draft' },
        { label: 'Published（發布）', value: 'published' },
        { label: 'Closed（關閉）', value: 'closed' },
        { label: 'Cancelled（取消）', value: 'cancelled' },
      ],
      defaultValue: 'draft',
      validation: { isRequired: true },
    }),
    isBoost: checkbox({
      label: '置頂',
      defaultValue: false,
      ui: {
        description: '勾選後供前台或 API 將此活動優先排序／置頂顯示。',
      },
    }),
    startAt: timestamp({
      label: '活動開始時間',
      db: { isNullable: true },
    }),
    endAt: timestamp({
      label: '活動結束時間',
      db: { isNullable: true },
    }),
    registrationStartAt: timestamp({
      label: '報名開始時間',
      db: { isNullable: true },
    }),
    registrationEndAt: timestamp({
      label: '報名結束時間',
      db: { isNullable: true },
    }),
    checkInStartAt: timestamp({
      label: '報到開始時間',
      db: { isNullable: true },
    }),
    checkInEndAt: timestamp({
      label: '報到結束時間',
      db: { isNullable: true },
    }),
    capacity: integer({
      label: '報名名額',
      db: { isNullable: true },
      validation: { min: 0 },
      ui: {
        description: '未填表示不限制名額。',
      },
    }),
    registrations: relationship({
      ref: 'EventRegistration.event',
      many: true,
      label: '報名紀錄',
    }),
    editorChoices: relationship({
      ref: 'EditorChoice.event',
      many: true,
      label: '編輯精選（關聯）',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'hidden' },
        listView: { fieldMode: 'hidden' },
      },
    }),
  },
  ui: {
    label: '活動',
    labelField: 'title',
    listView: {
      initialColumns: [
        'title',
        'status',
        'isBoost',
        'images',
        'externalLink',
        'startAt',
        'endAt',
        'registrationStartAt',
        'registrationEndAt',
        'checkInStartAt',
        'checkInEndAt',
      ],
      initialSort: { field: 'startAt', direction: 'DESC' },
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
    validateInput: ({ resolvedData, operation, addValidationError }) => {
      if (operation !== 'create' && operation !== 'update') return
      const externalLink = resolvedData.externalLink
      if (typeof externalLink === 'string' && !isSafeLinkUrl(externalLink)) {
        addValidationError(
          '活動連結僅允許 http/https 絕對網址或以 / 開頭的站內路徑。'
        )
      }
    },
    afterOperation: async ({ operation, item, context }) => {
      if (operation === 'delete') return
      const rawId = (item as { id?: unknown })?.id
      const eventId =
        typeof rawId === 'number'
          ? rawId
          : rawId != null
            ? Number(rawId)
            : NaN
      if (Number.isFinite(eventId)) {
        await syncEditorChoiceStateForEventId(context, eventId)
      }
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
