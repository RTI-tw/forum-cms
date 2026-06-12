import { graphql } from '@keystone-6/core'
import type { KeystoneContext } from '@keystone-6/core/types'
import crypto from 'crypto'
import envVar from '../environment-variables'
import { verifyMemberSession } from './member-session'
import {
  generateEventQrToken,
  hashEventQrToken,
  normalizeEventQrTokenInput,
} from './event-qr-token'
import {
  getEventPreviewAvailabilityStatus,
  type EventPreviewAvailabilityStatus,
} from './event-preview-status'

export { getEventPreviewAvailabilityStatus } from './event-preview-status'

const SUPPORTED_IDENTITY_TYPES = new Set([
  'national_id',
  'resident_certificate',
])

type EventRegistrationRecord = {
  id: number
  status?: string | null
  registeredAt?: Date | string | null
  checkedInAt?: Date | string | null
  identityMasked?: string | null
  phoneMasked?: string | null
  lastQrTokenUsedAt?: Date | string | null
  eventId?: number | null
  memberId?: number | null
  event?: {
    id: number
    slug?: string | null
    label?: EventLabel | string | null
    notice?: string | null
    externalLink?: string | null
    startAt?: Date | string | null
    endAt?: Date | string | null
    registrationStartAt?: Date | string | null
    registrationEndAt?: Date | string | null
    checkInStartAt?: Date | string | null
    checkInEndAt?: Date | string | null
    capacity?: number | null
    post?: EventPostRecord | null
  } | null
  member?: {
    id: number
    name?: string | null
    nickname?: string | null
    customId?: string | null
    email?: string | null
  } | null
}

type EventPostRecord = {
  id: number
  title?: string | null
  content?: string | null
  status?: string | null
  heroImages?: EventImageRecord[] | null
}

type EventImageRecord = {
  id: number
  name?: string | null
  urlOriginal?: string | null
  altText?: string | null
  caption?: string | null
  sortOrder?: number | null
}

type CheckInPreview = {
  ok: boolean
  canCheckIn: boolean
  code: string
  message: string
  registrationId?: string | null
  registrationStatus?: string | null
  eventId?: string | null
  eventTitle?: string | null
  eventSlug?: string | null
  memberId?: string | null
  memberName?: string | null
  memberNickname?: string | null
  memberEmail?: string | null
  registeredAt?: string | null
  checkedInAt?: string | null
}

type RegistrationWindow = {
  registrationStartAt?: Date | string | null
  registrationEndAt?: Date | string | null
}

type EventLabel = 'hot' | 'more' | 'past'

type PublicEvent = {
  id: string
  title?: string | null
  slug?: string | null
  label?: string | null
  notice?: string | null
  content?: string | null
  externalLink?: string | null
  status?: string | null
  startAt?: string | null
  endAt?: string | null
  registrationStartAt?: string | null
  registrationEndAt?: string | null
  checkInStartAt?: string | null
  checkInEndAt?: string | null
  capacity?: number | null
  images: PublicEventImage[]
  registrationCount: number
  remainingCapacity?: number | null
  isRegistrationOpen: boolean
}

type EventPreviewItem = PublicEvent & {
  firstImage?: PublicEventImage | null
  availabilityStatus: EventPreviewAvailabilityStatus
  isRegistered: boolean
}

type EventPreviewSections = Record<EventLabel, EventPreviewItem[]>

type PublicEventImage = {
  id: string
  name?: string | null
  urlOriginal?: string | null
  altText?: string | null
  caption?: string | null
  sortOrder?: number | null
}

type MemberEventRegistration = {
  id: string
  status?: string | null
  registeredAt?: string | null
  checkedInAt?: string | null
  identityMasked?: string | null
  phoneMasked?: string | null
  event: PublicEvent
}

type EventRegistrationFormInput = {
  identityType: string
  identityNumber: string
  phoneNumber: string
}

type RegisterForEventInput = EventRegistrationFormInput & {
  eventSlug: string
}

type NormalizedEventRegistrationForm = {
  identityType: string
  identityMasked: string
  identityHash: string
  phoneMasked: string
  phoneHash: string
}

const EVENT_LABELS: EventLabel[] = ['hot', 'more', 'past']
const ACTIVE_REGISTRATION_STATUSES = ['registered', 'checkedIn'] as const

function getBearerToken(context: KeystoneContext) {
  const authHeader = context.req?.headers?.authorization
  if (typeof authHeader !== 'string') {
    return null
  }
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = authHeader.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

async function requireActiveMember(context: KeystoneContext) {
  const token = getBearerToken(context)
  if (!token) {
    throw new Error('會員尚未登入')
  }

  const payload = verifyMemberSession(token)
  const member = await context.prisma.member.findUnique({
    where: { id: Number(payload.memberId) },
    select: { id: true, status: true },
  })

  if (!member || member.status !== 'active') {
    throw new Error('會員狀態不可使用活動功能')
  }

  return member
}

async function getActiveMemberIdIfAvailable(context: KeystoneContext) {
  const token = getBearerToken(context)
  if (!token) {
    return null
  }

  try {
    const payload = verifyMemberSession(token)
    const member = await context.prisma.member.findUnique({
      where: { id: Number(payload.memberId) },
      select: { id: true, status: true },
    })

    return member?.status === 'active' ? member.id : null
  } catch {
    return null
  }
}

function requireCmsUserId(context: KeystoneContext) {
  const itemId = context.session?.itemId
  if (!itemId) {
    throw new Error('CMS 使用者尚未登入')
  }

  const userId = Number(itemId)
  if (!Number.isInteger(userId)) {
    throw new Error('CMS 使用者狀態無效')
  }

  return userId
}

function toIsoString(value?: Date | string | null) {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(value).toISOString()
}

function isBefore(value: Date | string | null | undefined, now: Date) {
  return Boolean(value && new Date(value).getTime() > now.getTime())
}

function isAfter(value: Date | string | null | undefined, now: Date) {
  return Boolean(value && new Date(value).getTime() < now.getTime())
}

function normalizeIdentityNumber(value?: string | null) {
  return (value ?? '').trim().replace(/[\s-]/g, '').toUpperCase()
}

function normalizePhoneNumber(value?: string | null) {
  return (value ?? '').replace(/\D/g, '')
}

function maskIdentifier(value: string, visibleStart: number, visibleEnd: number) {
  if (value.length <= visibleStart + visibleEnd) {
    return `${value.slice(0, 1)}${'*'.repeat(Math.max(value.length - 2, 1))}${value.slice(-1)}`
  }

  return `${value.slice(0, visibleStart)}${'*'.repeat(
    value.length - visibleStart - visibleEnd
  )}${value.slice(-visibleEnd)}`
}

function hashRegistrationValue(kind: 'identity' | 'phone', value: string) {
  return crypto
    .createHash('sha256')
    .update(kind)
    .update(':')
    .update(value)
    .update(':')
    .update(envVar.memberSession.secret)
    .update(':event-registration')
    .digest('hex')
}

export function normalizeEventRegistrationForm(
  input: EventRegistrationFormInput
): NormalizedEventRegistrationForm {
  const identityType = typeof input.identityType === 'string'
    ? input.identityType.trim()
    : ''
  if (!SUPPORTED_IDENTITY_TYPES.has(identityType)) {
    throw new Error('不支援的證件類型')
  }

  const identityNumber = normalizeIdentityNumber(input.identityNumber)
  if (!identityNumber) {
    throw new Error('請輸入證件號碼')
  }

  const phoneNumber = normalizePhoneNumber(input.phoneNumber)
  if (!phoneNumber) {
    throw new Error('請輸入手機號碼')
  }

  return {
    identityType,
    identityMasked: maskIdentifier(identityNumber, 2, 2),
    identityHash: hashRegistrationValue('identity', identityNumber),
    phoneMasked: maskIdentifier(phoneNumber, 4, 3),
    phoneHash: hashRegistrationValue('phone', phoneNumber),
  }
}

export function isRegistrationOpen(event: RegistrationWindow, now = new Date()) {
  if (isBefore(event.registrationStartAt, now)) {
    return false
  }

  if (isAfter(event.registrationEndAt, now)) {
    return false
  }

  return true
}

function isKnownEventLabel(value?: string | null): value is EventLabel {
  return EVENT_LABELS.includes(value as EventLabel)
}

function buildPublicEvent(
  event: NonNullable<EventRegistrationRecord['event']>,
  registrationCount = 0,
  now = new Date()
): PublicEvent {
  const capacity = typeof event.capacity === 'number' ? event.capacity : null
  const remainingCapacity =
    capacity === null ? null : Math.max(capacity - registrationCount, 0)
  const post = event.post ?? null

  return {
    id: String(event.id),
    title: post?.title ?? null,
    slug: event.slug ?? null,
    label: event.label ?? null,
    notice: event.notice ?? null,
    content: post?.content ?? null,
    externalLink: event.externalLink ?? null,
    status: post?.status ?? null,
    startAt: toIsoString(event.startAt),
    endAt: toIsoString(event.endAt),
    registrationStartAt: toIsoString(event.registrationStartAt),
    registrationEndAt: toIsoString(event.registrationEndAt),
    checkInStartAt: toIsoString(event.checkInStartAt),
    checkInEndAt: toIsoString(event.checkInEndAt),
    capacity,
    images: (post?.heroImages ?? []).map((image) => ({
      id: String(image.id),
      name: image.name ?? null,
      urlOriginal: image.urlOriginal ?? null,
      altText: image.altText ?? null,
      caption: image.caption ?? null,
      sortOrder: image.sortOrder ?? null,
    })),
    registrationCount,
    remainingCapacity,
    isRegistrationOpen:
      post?.status === 'published' && isRegistrationOpen(event, now),
  }
}

export function buildEventPreviewItem(
  event: NonNullable<EventRegistrationRecord['event']>,
  registrationCount = 0,
  isRegistered = false,
  now = new Date()
): EventPreviewItem {
  const publicEvent = buildPublicEvent(event, registrationCount, now)

  return {
    ...publicEvent,
    firstImage: publicEvent.images[0] ?? null,
    availabilityStatus: getEventPreviewAvailabilityStatus(
      event,
      registrationCount,
      now
    ),
    isRegistered,
  }
}

async function countActiveRegistrations(
  context: KeystoneContext,
  eventId: number
) {
  return context.prisma.eventRegistration.count({
    where: {
      eventId,
      status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
    },
  })
}

async function buildMemberEventRegistration(
  context: KeystoneContext,
  registration: EventRegistrationRecord
): Promise<MemberEventRegistration> {
  if (!registration.event) {
    throw new Error('活動報名紀錄缺少活動資料')
  }

  const registrationCount = await countActiveRegistrations(
    context,
    registration.event.id
  )

  return {
    id: String(registration.id),
    status: registration.status ?? null,
    registeredAt: toIsoString(registration.registeredAt),
    checkedInAt: toIsoString(registration.checkedInAt),
    identityMasked: registration.identityMasked ?? null,
    phoneMasked: registration.phoneMasked ?? null,
    event: buildPublicEvent(registration.event, registrationCount),
  }
}

export function buildEventCheckInPreview(
  registration: EventRegistrationRecord | null,
  now = new Date()
): CheckInPreview {
  if (!registration) {
    return {
      ok: false,
      canCheckIn: false,
      code: 'INVALID_TOKEN',
      message: 'QR Code 無效',
    }
  }

  const base = {
    registrationId: String(registration.id),
    registrationStatus: registration.status ?? null,
    eventId: registration.event?.id != null ? String(registration.event.id) : null,
    eventTitle: registration.event?.post?.title ?? null,
    eventSlug: registration.event?.slug ?? null,
    memberId: registration.member?.id != null ? String(registration.member.id) : null,
    memberName: registration.member?.name ?? null,
    memberNickname: registration.member?.nickname ?? null,
    memberEmail: registration.member?.email ?? null,
    registeredAt: toIsoString(registration.registeredAt),
    checkedInAt: toIsoString(registration.checkedInAt),
  }

  if (registration.lastQrTokenUsedAt) {
    return {
      ok: false,
      canCheckIn: false,
      code: 'TOKEN_USED',
      message: '這個 QR Code 已使用過',
      ...base,
    }
  }

  if (registration.status === 'checkedIn') {
    return {
      ok: false,
      canCheckIn: false,
      code: 'ALREADY_CHECKED_IN',
      message: '此報名紀錄已完成報到',
      ...base,
    }
  }

  if (registration.status === 'cancelled') {
    return {
      ok: false,
      canCheckIn: false,
      code: 'REGISTRATION_CANCELLED',
      message: '此報名紀錄已取消',
      ...base,
    }
  }

  if (registration.status !== 'registered') {
    return {
      ok: false,
      canCheckIn: false,
      code: 'REGISTRATION_NOT_ACTIVE',
      message: '此報名紀錄目前不可報到',
      ...base,
    }
  }

  if (!registration.event || registration.event.post?.status !== 'published') {
    return {
      ok: false,
      canCheckIn: false,
      code: 'EVENT_NOT_PUBLISHED',
      message: '活動目前未開放報到',
      ...base,
    }
  }

  if (isBefore(registration.event.checkInStartAt, now)) {
    return {
      ok: false,
      canCheckIn: false,
      code: 'CHECK_IN_NOT_STARTED',
      message: '活動尚未開始報到',
      ...base,
    }
  }

  if (isAfter(registration.event.checkInEndAt, now)) {
    return {
      ok: false,
      canCheckIn: false,
      code: 'CHECK_IN_CLOSED',
      message: '活動報到已結束',
      ...base,
    }
  }

  return {
    ok: true,
    canCheckIn: true,
    code: 'READY',
    message: '可報到',
    ...base,
  }
}

async function findRegistrationByToken(context: KeystoneContext, token: string) {
  const normalized = normalizeEventQrTokenInput(token)
  if (!normalized) {
    return null
  }

  return context.prisma.eventRegistration.findFirst({
    where: { lastQrTokenHash: hashEventQrToken(normalized) },
    include: {
      event: {
        include: {
          post: true,
        },
      },
      member: true,
    },
  }) as Promise<EventRegistrationRecord | null>
}

const EventCheckInQrTokenResult = graphql.object<{
  token: string
  issuedAt: string
}>()({
  name: 'EventCheckInQrTokenResult',
  fields: {
    token: graphql.field({ type: graphql.nonNull(graphql.String) }),
    issuedAt: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
})

const EventCheckInPreviewResult = graphql.object<CheckInPreview>()({
  name: 'EventCheckInPreviewResult',
  fields: {
    ok: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    canCheckIn: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    code: graphql.field({ type: graphql.nonNull(graphql.String) }),
    message: graphql.field({ type: graphql.nonNull(graphql.String) }),
    registrationId: graphql.field({ type: graphql.ID }),
    registrationStatus: graphql.field({ type: graphql.String }),
    eventId: graphql.field({ type: graphql.ID }),
    eventTitle: graphql.field({ type: graphql.String }),
    eventSlug: graphql.field({ type: graphql.String }),
    memberId: graphql.field({ type: graphql.ID }),
    memberName: graphql.field({ type: graphql.String }),
    memberNickname: graphql.field({ type: graphql.String }),
    memberEmail: graphql.field({ type: graphql.String }),
    registeredAt: graphql.field({ type: graphql.String }),
    checkedInAt: graphql.field({ type: graphql.String }),
  },
})

const EventRegistrationEventImageResult = graphql.object<PublicEventImage>()({
  name: 'EventRegistrationEventImageResult',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.String }),
    urlOriginal: graphql.field({ type: graphql.String }),
    altText: graphql.field({ type: graphql.String }),
    caption: graphql.field({ type: graphql.String }),
    sortOrder: graphql.field({ type: graphql.Int }),
  },
})

const EventPreviewAvailabilityStatusType = graphql.enum({
  name: 'EventPreviewAvailabilityStatus',
  values: graphql.enumValues(['open', 'notStarted', 'full', 'closed']),
})

const EventRegistrationEventResult = graphql.object<PublicEvent>()({
  name: 'EventRegistrationEventResult',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    title: graphql.field({ type: graphql.String }),
    slug: graphql.field({ type: graphql.String }),
    label: graphql.field({ type: graphql.String }),
    notice: graphql.field({ type: graphql.String }),
    content: graphql.field({ type: graphql.String }),
    externalLink: graphql.field({ type: graphql.String }),
    status: graphql.field({ type: graphql.String }),
    startAt: graphql.field({ type: graphql.String }),
    endAt: graphql.field({ type: graphql.String }),
    registrationStartAt: graphql.field({ type: graphql.String }),
    registrationEndAt: graphql.field({ type: graphql.String }),
    checkInStartAt: graphql.field({ type: graphql.String }),
    checkInEndAt: graphql.field({ type: graphql.String }),
    capacity: graphql.field({ type: graphql.Int }),
    images: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(EventRegistrationEventImageResult))
      ),
    }),
    registrationCount: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    remainingCapacity: graphql.field({ type: graphql.Int }),
    isRegistrationOpen: graphql.field({
      type: graphql.nonNull(graphql.Boolean),
    }),
  },
})

const EventPreviewImageResult = graphql.object<PublicEventImage>()({
  name: 'EventPreviewImageResult',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.String }),
    urlOriginal: graphql.field({ type: graphql.String }),
    altText: graphql.field({ type: graphql.String }),
    caption: graphql.field({ type: graphql.String }),
    sortOrder: graphql.field({ type: graphql.Int }),
  },
})

const EventPreviewItemResult = graphql.object<EventPreviewItem>()({
  name: 'EventPreviewItemResult',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    title: graphql.field({ type: graphql.String }),
    slug: graphql.field({ type: graphql.String }),
    label: graphql.field({ type: graphql.String }),
    notice: graphql.field({ type: graphql.String }),
    externalLink: graphql.field({ type: graphql.String }),
    startAt: graphql.field({ type: graphql.String }),
    endAt: graphql.field({ type: graphql.String }),
    registrationStartAt: graphql.field({ type: graphql.String }),
    registrationEndAt: graphql.field({ type: graphql.String }),
    capacity: graphql.field({ type: graphql.Int }),
    firstImage: graphql.field({ type: EventPreviewImageResult }),
    images: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(EventPreviewImageResult))
      ),
    }),
    registrationCount: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    remainingCapacity: graphql.field({ type: graphql.Int }),
    availabilityStatus: graphql.field({
      type: graphql.nonNull(EventPreviewAvailabilityStatusType),
    }),
    isRegistered: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
  },
})

const EventPreviewSectionsResult = graphql.object<EventPreviewSections>()({
  name: 'EventPreviewSectionsResult',
  fields: {
    hot: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(EventPreviewItemResult))
      ),
    }),
    more: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(EventPreviewItemResult))
      ),
    }),
    past: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(EventPreviewItemResult))
      ),
    }),
  },
})

const MemberEventRegistrationResult = graphql.object<MemberEventRegistration>()({
  name: 'MemberEventRegistrationResult',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    status: graphql.field({ type: graphql.String }),
    registeredAt: graphql.field({ type: graphql.String }),
    checkedInAt: graphql.field({ type: graphql.String }),
    identityMasked: graphql.field({ type: graphql.String }),
    phoneMasked: graphql.field({ type: graphql.String }),
    event: graphql.field({
      type: graphql.nonNull(EventRegistrationEventResult),
    }),
  },
})

const RegisterForEventInputType = graphql.inputObject({
  name: 'RegisterForEventInput',
  fields: {
    eventSlug: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    identityType: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    identityNumber: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    phoneNumber: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
})

export const eventRegistrationSchemaExtension = graphql.extend(() => ({
  query: {
    eventPreviews: graphql.field({
      type: graphql.nonNull(EventPreviewSectionsResult),
      async resolve(
        _root: unknown,
        _args: Record<string, unknown>,
        context: KeystoneContext
      ) {
        const events = (await context.prisma.event.findMany({
          where: { post: { is: { status: 'published' } } },
          include: {
            post: {
              include: {
                heroImages: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
          orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        })) as NonNullable<EventRegistrationRecord['event']>[]

        const memberId = await getActiveMemberIdIfAvailable(context)
        const memberRegistrations: Array<{ eventId: number | null }> = memberId
          ? ((await context.prisma.eventRegistration.findMany({
              where: {
                memberId,
                eventId: { in: events.map((event) => event.id) },
                status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
              },
              select: { eventId: true },
            })) as Array<{ eventId: number | null }>)
          : []
        const registeredEventIds = new Set(
          memberRegistrations
            .map((registration) => registration.eventId)
            .filter((eventId): eventId is number => typeof eventId === 'number')
        )

        const registrationCounts = new Map<number, number>()
        await Promise.all(
          events.map(async (event) => {
            registrationCounts.set(
              event.id,
              await countActiveRegistrations(context, event.id)
            )
          })
        )

        const sections: EventPreviewSections = {
          hot: [],
          more: [],
          past: [],
        }
        const now = new Date()

        for (const event of events) {
          const label = isKnownEventLabel(event.label) ? event.label : 'more'
          sections[label].push(
            buildEventPreviewItem(
              event,
              registrationCounts.get(event.id) ?? 0,
              registeredEventIds.has(event.id),
              now
            )
          )
        }

        return sections
      },
    }),
    eventBySlug: graphql.field({
      type: EventRegistrationEventResult,
      args: {
        slug: graphql.arg({ type: graphql.nonNull(graphql.String) }),
      },
      async resolve(
        _root: unknown,
        { slug }: { slug: string },
        context: KeystoneContext
      ) {
        const normalizedSlug = typeof slug === 'string' ? slug.trim() : ''
        if (!normalizedSlug) {
          return null
        }

        const event = (await context.prisma.event.findUnique({
          where: { slug: normalizedSlug },
          include: {
            post: {
              include: {
                heroImages: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        })) as EventRegistrationRecord['event']

        if (!event || event.post?.status !== 'published') {
          return null
        }

        const registrationCount = await countActiveRegistrations(
          context,
          event.id
        )

        return buildPublicEvent(event, registrationCount)
      },
    }),
    myEventRegistrations: graphql.field({
      type: graphql.nonNull(
        graphql.list(graphql.nonNull(MemberEventRegistrationResult))
      ),
      async resolve(
        _root: unknown,
        _args: Record<string, unknown>,
        context: KeystoneContext
      ) {
        const member = await requireActiveMember(context)
        const registrations = (await context.prisma.eventRegistration.findMany({
          where: { memberId: member.id },
          include: {
            event: {
              include: {
                post: {
                  include: {
                    heroImages: { orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
            },
          },
          orderBy: { registeredAt: 'desc' },
        })) as EventRegistrationRecord[]

        return Promise.all(
          registrations.map((registration) =>
            buildMemberEventRegistration(context, registration)
          )
        )
      },
    }),
    previewEventCheckInToken: graphql.field({
      type: graphql.nonNull(EventCheckInPreviewResult),
      args: {
        token: graphql.arg({ type: graphql.nonNull(graphql.String) }),
      },
      async resolve(
        _root: unknown,
        { token }: { token: string },
        context: KeystoneContext
      ) {
        requireCmsUserId(context)
        const registration = await findRegistrationByToken(context, token)
        return buildEventCheckInPreview(registration)
      },
    }),
  },
  mutation: {
    registerForEvent: graphql.field({
      type: graphql.nonNull(MemberEventRegistrationResult),
      args: {
        data: graphql.arg({
          type: graphql.nonNull(RegisterForEventInputType),
        }),
      },
      async resolve(
        _root: unknown,
        { data }: { data: RegisterForEventInput },
        context: KeystoneContext
      ) {
        const member = await requireActiveMember(context)
        const normalizedSlug =
          typeof data.eventSlug === 'string' ? data.eventSlug.trim() : ''
        if (!normalizedSlug) {
          throw new Error('找不到活動')
        }

        const form = normalizeEventRegistrationForm(data)
        const event = (await context.prisma.event.findUnique({
          where: { slug: normalizedSlug },
          include: {
            post: true,
          },
        })) as EventRegistrationRecord['event']

        if (!event || event.post?.status !== 'published') {
          throw new Error('活動目前未開放報名')
        }

        if (!isRegistrationOpen(event)) {
          throw new Error('活動目前不在報名期間')
        }

        const duplicate = await context.prisma.eventRegistration.findFirst({
          where: {
            eventId: event.id,
            OR: [
              { memberId: member.id },
              { identityHash: form.identityHash },
            ],
          },
        })

        if (duplicate) {
          throw new Error('此會員或證件已報名過此活動')
        }

        const registrationCount = await countActiveRegistrations(
          context,
          event.id
        )
        if (
          typeof event.capacity === 'number' &&
          registrationCount >= event.capacity
        ) {
          throw new Error('活動名額已滿')
        }

        try {
          const registration = (await context.prisma.eventRegistration.create({
            data: {
              eventId: event.id,
              memberId: member.id,
              status: 'registered',
              registeredAt: new Date(),
              identityType: form.identityType,
              identityMasked: form.identityMasked,
              identityHash: form.identityHash,
              phoneMasked: form.phoneMasked,
              phoneHash: form.phoneHash,
            },
            include: {
              event: {
                include: {
                  post: {
                    include: {
                      heroImages: { orderBy: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          })) as EventRegistrationRecord

          return buildMemberEventRegistration(context, registration)
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            (error as { code?: string }).code === 'P2002'
          ) {
            throw new Error('此會員或證件已報名過此活動')
          }
          throw error
        }
      },
    }),
    issueEventCheckInQrToken: graphql.field({
      type: graphql.nonNull(EventCheckInQrTokenResult),
      args: {
        registrationId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
      },
      async resolve(
        _root: unknown,
        { registrationId }: { registrationId: string },
        context: KeystoneContext
      ) {
        const member = await requireActiveMember(context)
        const registration = (await context.prisma.eventRegistration.findUnique({
          where: { id: Number(registrationId) },
          include: {
            event: {
              include: {
                post: true,
              },
            },
            member: true,
          },
        })) as EventRegistrationRecord | null

        if (!registration || String(registration.memberId) !== String(member.id)) {
          throw new Error('找不到可使用的活動報名紀錄')
        }

        const preview = buildEventCheckInPreview(registration)
        if (!preview.canCheckIn) {
          throw new Error(preview.message)
        }

        const token = generateEventQrToken()
        const issuedAt = new Date()

        await context.prisma.eventRegistration.update({
          where: { id: registration.id },
          data: {
            lastQrTokenHash: hashEventQrToken(token),
            lastQrTokenIssuedAt: issuedAt,
            lastQrTokenUsedAt: null,
          },
        })

        return {
          token,
          issuedAt: issuedAt.toISOString(),
        }
      },
    }),
    confirmEventCheckIn: graphql.field({
      type: graphql.nonNull(EventCheckInPreviewResult),
      args: {
        token: graphql.arg({ type: graphql.nonNull(graphql.String) }),
      },
      async resolve(
        _root: unknown,
        { token }: { token: string },
        context: KeystoneContext
      ) {
        const userId = requireCmsUserId(context)
        const normalized = normalizeEventQrTokenInput(token)
        if (!normalized) {
          return buildEventCheckInPreview(null)
        }

        const tokenHash = hashEventQrToken(normalized)
        const registration = await findRegistrationByToken(context, normalized)
        const preview = buildEventCheckInPreview(registration)
        if (!registration || !preview.canCheckIn) {
          return preview
        }

        const checkedInAt = new Date()
        const result = await context.prisma.eventRegistration.updateMany({
          where: {
            id: registration.id,
            status: 'registered',
            lastQrTokenHash: tokenHash,
            lastQrTokenUsedAt: null,
          },
          data: {
            status: 'checkedIn',
            checkedInAt,
            checkedInById: userId,
            lastQrTokenUsedAt: checkedInAt,
          },
        })

        if (result.count !== 1) {
          const latest = await findRegistrationByToken(context, normalized)
          return buildEventCheckInPreview(latest)
        }

        const updated = (await context.prisma.eventRegistration.findUnique({
          where: { id: registration.id },
          include: {
            event: {
              include: {
                post: true,
              },
            },
            member: true,
          },
        })) as EventRegistrationRecord | null

        return {
          ...buildEventCheckInPreview(updated),
          ok: true,
          canCheckIn: false,
          code: 'CHECKED_IN',
          message: '報到成功',
        }
      },
    }),
  },
}))
