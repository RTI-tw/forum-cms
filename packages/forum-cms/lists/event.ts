import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from '@keystone-6/core/fields'

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
    description: text({
      label: '活動說明',
      ui: { displayMode: 'textarea' },
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
  },
  ui: {
    label: '活動',
    labelField: 'title',
    listView: {
      initialColumns: [
        'title',
        'status',
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
})

export default utils.addTrackingFields(listConfigurations)
