import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor, partner } from '../utils/access-control'
import { connectedId, getPartnerMemberId, isPartnerSession, partnerOwnsPost, requirePartnerMemberId } from '../utils/partner-access'
import { graphql, list } from '@keystone-6/core'
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from '@keystone-6/core/fields'
import { isSafeLinkUrl } from '../utils/url-safety'
import { getEventPreviewAvailabilityStatus } from '../utils/event-preview-status'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'

type ToOneRelationInput = {
  connect?: { id?: string | number | null } | null
  create?: unknown
  disconnect?: boolean
}

const ACTIVE_REGISTRATION_STATUSES = ['registered', 'checkedIn'] as const

type EventAvailabilityItem = {
  id?: number | string | null
  endAt?: Date | string | null
  registrationStartAt?: Date | string | null
  registrationEndAt?: Date | string | null
  capacity?: number | null
}

function hasRelatedPost(value: unknown) {
  const relation = value as ToOneRelationInput | undefined
  return Boolean(relation?.connect?.id != null || relation?.create)
}

const listConfigurations = list({
  fields: {
    slug: text({
      label: '活動網址名稱',
      validation: { isRequired: true },
      isIndexed: 'unique',
      ui: {
        description: '供前台活動頁與 API 查詢使用，建議使用英數與連字號。',
      },
    }),
    label: select({
      label: '活動標籤',
      type: 'enum',
      options: [
        { label: '熱門活動', value: 'hot' },
        { label: '更多活動', value: 'more' },
        { label: '活動回顧', value: 'past' },
      ],
      defaultValue: 'more',
      validation: { isRequired: true },
      ui: {
        description: '決定活動預覽卡顯示在哪個前台區塊。',
      },
    }),
    notice: text({
      label: '活動須知',
      validation: {
        length: { max: 100 },
      },
      ui: {
        displayMode: 'textarea',
        description: '最多 100 字。',
      },
    }),
    notice_zh: text({
      label: '活動須知（中文）',
      ui: {
        description: '五國語言翻譯欄位之一；可透過 message-services 依原文同步。',
      },
    }),
    notice_en: text({ label: '活動須知（英文）' }),
    notice_vi: text({ label: '活動須知（越南文）' }),
    notice_id: text({ label: '活動須知（印尼文）' }),
    notice_th: text({ label: '活動須知（泰文）' }),
    availabilityStatus: virtual({
      label: '活動狀態',
      field: graphql.field({
        type: graphql.String,
        resolve: async (item, _args, context) => {
          const event = item as EventAvailabilityItem
          const eventId = Number(event.id)

          if (!Number.isFinite(eventId)) {
            return getEventPreviewAvailabilityStatus(event)
          }

          const [storedEvent, registrationCount] = await Promise.all([
            context.prisma.event.findUnique({
              where: { id: eventId },
              select: {
                endAt: true,
                registrationStartAt: true,
                registrationEndAt: true,
                capacity: true,
              },
            }),
            context.prisma.eventRegistration.count({
              where: {
                eventId,
                status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
              },
            }),
          ])

          return getEventPreviewAvailabilityStatus(
            storedEvent ?? event,
            registrationCount
          )
        },
      }),
    }),
    post: relationship({
      ref: 'Post.events',
      many: false,
      label: '文章',
      ui: {
        hideCreate: true,
        description:
          '活動內容、圖片、發布狀態、互動功能由關聯文章管理；此處只保留活動特定設定。',
      },
    }),
    externalLink: text({
      label: '活動連結',
      ui: {
        description: '選填；可放活動外部頁面、直播、地圖或其他相關連結。',
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
    creator: relationship({
      ref: 'Member.partnerEvents',
      many: false,
      label: '建立者',
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
  },
  ui: {
    label: '活動',
    labelField: 'slug',
    listView: {
      initialColumns: [
        'slug',
        'label',
        'notice',
        'notice_zh',
        'notice_en',
        'availabilityStatus',
        'post',
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
      query: allowRoles(admin, moderator, editor, partner),
      update: allowRoles(admin, moderator, editor, partner),
      create: allowRoles(admin, moderator, editor, partner),
      delete: allowRoles(admin, editor),
    },
    filter: {
      query: ({ context }) => {
        if (!isPartnerSession(context)) return true
        return getPartnerMemberId(context).then((memberId) =>
          memberId == null ? false : { creator: { id: { equals: memberId } } }
        )
      },
      update: ({ context }) => {
        if (!isPartnerSession(context)) return true
        return getPartnerMemberId(context).then((memberId) =>
          memberId == null ? false : { creator: { id: { equals: memberId } } }
        )
      },
    },
  },
  hooks: {
    validateInput: async ({ resolvedData, operation, addValidationError, context }) => {
      if (operation !== 'create' && operation !== 'update') return
      const postRelation = resolvedData.post as ToOneRelationInput | undefined
      if (operation === 'create' && !hasRelatedPost(postRelation)) {
        addValidationError('活動必須關聯一篇文章。')
      }
      if (operation === 'update' && postRelation?.disconnect === true) {
        addValidationError('活動必須保留關聯文章，不能解除關聯。')
      }
      const externalLink = resolvedData.externalLink
      if (typeof externalLink === 'string' && !isSafeLinkUrl(externalLink)) {
        addValidationError(
          '活動連結僅允許 http/https 絕對網址或以 / 開頭的站內路徑。'
        )
      }
      if (isPartnerSession(context)) {
        const postId = connectedId(resolvedData.post)
        if (postId != null && !(await partnerOwnsPost(context, postId))) {
          addValidationError('Partner 只能關聯自己的文章。')
        }
      }
    },
    resolveInput: async ({ resolvedData, operation, context }) => {
      if (!isPartnerSession(context)) return resolvedData
      const data = { ...resolvedData }
      if (operation === 'create') {
        const memberId = await requirePartnerMemberId(context)
        data.creator = { connect: { id: memberId } }
      } else {
        delete data.creator
      }
      return data
    },
    afterOperation: createMessageServicesTranslationHook('event'),
  },
})

export default utils.addTrackingFields(listConfigurations)
