import { list } from '@keystone-6/core'
import { text, relationship, select, timestamp } from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'

const { allowRoles, admin, moderator, editor } = utils.accessControl

const listConfigurations = list({
  fields: {
    title: text({
      label: '廣告名稱 Title',
      ui: {
        description: '內部辨識用，不對外顯示',
      },
      validation: { isRequired: true },
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
    image: relationship({
      ref: 'Photo',
      many: false,
      label: '廣告圖片 Image',
      ui: {
        description:
          '從圖片庫選擇。建議素材：桌機 728×90（超級橫幅）、手機 300×250（中矩形）。',
      },
    }),
    videoUrl: text({
      label: '廣告影音 VideoUrl',
      ui: {
        description: '選填；格式與是否啟用待確認後再填寫',
      },
    }),
    linkUrl: text({
      label: '廣告網址 LinkUrl',
      ui: {
        description: '使用者點擊後導向的目標網址',
      },
    }),
  },
  ui: {
    label: '廣告',
    listView: {
      initialColumns: ['title', 'status', 'startAt', 'endAt'],
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
