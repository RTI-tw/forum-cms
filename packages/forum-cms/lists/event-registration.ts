import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { relationship, select, text, timestamp } from '@keystone-6/core/fields'

const hiddenFromCmsUi = {
  createView: { fieldMode: 'hidden' as const },
  itemView: { fieldMode: 'hidden' as const },
  listView: { fieldMode: 'hidden' as const },
}

const hiddenFromCmsUiAndGraphql = {
  ui: hiddenFromCmsUi,
  graphql: { omit: true as const },
}

const readOnlyInCmsUi = {
  createView: { fieldMode: 'hidden' as const },
  itemView: { fieldMode: 'read' as const },
  listView: { fieldMode: 'read' as const },
}

function addEventRegistrationPrismaConstraints(schema: string) {
  if (schema.includes('@@unique([eventId, memberId])')) {
    return schema
  }

  return schema.replace(
    /\n}$/,
    [
      '',
      '  @@unique([eventId, memberId])',
      '  @@unique([eventId, identityHash])',
      '  @@index([eventId, status])',
      '}',
    ].join('\n')
  )
}

const listConfigurations = list({
  db: {
    extendPrismaSchema: addEventRegistrationPrismaConstraints,
  },
  fields: {
    event: relationship({
      ref: 'Event.registrations',
      many: false,
      label: '活動',
    }),
    member: relationship({
      ref: 'Member.eventRegistrations',
      many: false,
      label: '會員',
    }),
    status: select({
      label: '報名狀態',
      type: 'enum',
      options: [
        { label: 'Registered（已報名）', value: 'registered' },
        { label: 'Checked in（已報到）', value: 'checkedIn' },
        { label: 'Cancelled（已取消）', value: 'cancelled' },
      ],
      defaultValue: 'registered',
      validation: { isRequired: true },
    }),
    registeredAt: timestamp({
      label: '報名時間',
      defaultValue: { kind: 'now' },
      ui: readOnlyInCmsUi,
    }),
    checkedInAt: timestamp({
      label: '報到時間',
      db: { isNullable: true },
      ui: readOnlyInCmsUi,
    }),
    checkedInBy: relationship({
      ref: 'User',
      many: false,
      label: '報到工作人員',
      ui: readOnlyInCmsUi,
    }),
    cancelledAt: timestamp({
      label: '取消時間',
      db: { isNullable: true },
      ui: readOnlyInCmsUi,
    }),
    cancelledBy: relationship({
      ref: 'User',
      many: false,
      label: '取消操作人員',
      ui: readOnlyInCmsUi,
    }),
    identityType: select({
      label: '證件類型',
      type: 'enum',
      options: [
        { label: '身分證', value: 'national_id' },
        { label: '居留證', value: 'resident_certificate' },
      ],
      db: { isNullable: true },
    }),
    identityMasked: text({
      label: '證件號碼（遮罩）',
      db: { isNullable: true },
      ui: readOnlyInCmsUi,
    }),
    identityHash: text({
      label: '證件號碼 Hash',
      isIndexed: true,
      db: { isNullable: true },
      ...hiddenFromCmsUiAndGraphql,
    }),
    phoneMasked: text({
      label: '手機號碼（遮罩）',
      db: { isNullable: true },
      ui: readOnlyInCmsUi,
    }),
    phoneHash: text({
      label: '手機號碼 Hash',
      isIndexed: true,
      db: { isNullable: true },
      ...hiddenFromCmsUiAndGraphql,
    }),
    lastQrTokenHash: text({
      label: 'QR Token Hash',
      isIndexed: true,
      db: { isNullable: true },
      ...hiddenFromCmsUiAndGraphql,
    }),
    lastQrTokenIssuedAt: timestamp({
      label: 'QR Token 發行時間',
      db: { isNullable: true },
      ...hiddenFromCmsUiAndGraphql,
    }),
    lastQrTokenUsedAt: timestamp({
      label: 'QR Token 使用時間',
      db: { isNullable: true },
      ...hiddenFromCmsUiAndGraphql,
    }),
    checkInNotes: text({
      label: '報到備註',
      ui: { displayMode: 'textarea' },
    }),
  },
  ui: {
    label: '活動報名',
    listView: {
      initialColumns: [
        'event',
        'member',
        'status',
        'registeredAt',
        'checkedInAt',
        'checkedInBy',
      ],
      initialSort: { field: 'registeredAt', direction: 'DESC' },
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
