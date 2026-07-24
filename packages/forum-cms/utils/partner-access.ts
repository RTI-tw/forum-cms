import type { KeystoneContext } from '@keystone-6/core/types'

type SessionLike = { data?: { id?: unknown; role?: unknown }; itemId?: unknown }

function normalizeId(value: unknown): number | null {
  if (value == null) return null
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function isPartnerSession(value: { session?: unknown } | KeystoneContext) {
  const session = (value as { session?: SessionLike }).session
  return session?.data?.role === 'partner'
}

export function isPartnerUiSession(args: { session?: unknown }) {
  return isPartnerSession(args)
}

export async function getPartnerMemberId(
  context: KeystoneContext
): Promise<number | null> {
  if (!isPartnerSession(context)) return null
  const session = context.session as SessionLike | undefined
  const userId = normalizeId(session?.data?.id ?? session?.itemId)
  if (userId == null) return null

  const user = await context.sudo().prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      partnerMember: { select: { id: true, status: true } },
    },
  })
  if (user?.role !== 'partner' || user.partnerMember?.status !== 'active') {
    return null
  }
  return user.partnerMember.id
}

export async function requirePartnerMemberId(context: KeystoneContext) {
  const memberId = await getPartnerMemberId(context)
  if (memberId == null) {
    throw new Error('Partner 帳號尚未連結有效的前台會員')
  }
  return memberId
}

export async function partnerOwnsPost(context: KeystoneContext, postId: unknown) {
  const memberId = await getPartnerMemberId(context)
  const id = normalizeId(postId)
  if (memberId == null || id == null) return false
  return Boolean(await context.sudo().prisma.post.findFirst({
    where: { id, authorId: memberId },
    select: { id: true },
  }))
}

export async function partnerOwnsPoll(context: KeystoneContext, pollId: unknown) {
  const memberId = await getPartnerMemberId(context)
  const id = normalizeId(pollId)
  if (memberId == null || id == null) return false
  return Boolean(await context.sudo().prisma.poll.findFirst({
    where: { id, memberId },
    select: { id: true },
  }))
}

export function connectedId(value: unknown): unknown {
  return (value as { connect?: { id?: unknown } } | undefined)?.connect?.id
}

export function connectedIds(value: unknown): unknown[] {
  const connect = (value as { connect?: unknown } | undefined)?.connect
  if (!connect) return []
  const rows = Array.isArray(connect) ? connect : [connect]
  return rows.map((row) => (row as { id?: unknown })?.id).filter((id) => id != null)
}
