import type { KeystoneContext } from '@keystone-6/core/types'

import { getAuthenticatedMemberId } from './post-visibility'

export type MemberWhereUniqueInput = {
  id?: string | number | null
  firebaseId?: string | null
  customId?: string | null
  email?: string | null
}

type MemberRecord = {
  id: string | number
  status?: string | null
}

function hasUniqueMemberWhere(where: MemberWhereUniqueInput) {
  return Object.values(where).some((value) => {
    if (value === null || value === undefined) return false
    return String(value).trim().length > 0
  })
}

function isCmsAdminSession(context: KeystoneContext) {
  const session = context.session as
    | { data?: { role?: unknown }; itemId?: unknown }
    | undefined

  return Boolean(session?.itemId) && session?.data?.role === 'admin'
}

export async function softDeleteMemberByWhere(
  context: KeystoneContext,
  where: MemberWhereUniqueInput
) {
  if (!where || !hasUniqueMemberWhere(where)) {
    throw new Error('Member identifier is required')
  }

  const member = (await context.sudo().db.Member.findOne({
    where,
  })) as MemberRecord | null

  if (!member) {
    return null
  }

  const memberId = Number(member.id)
  if (!Number.isInteger(memberId)) {
    throw new Error('Member identifier is invalid')
  }

  const authenticatedMemberId = getAuthenticatedMemberId(context)
  const canDeleteOwnAccount = authenticatedMemberId === memberId
  const canDeleteAsCmsAdmin = isCmsAdminSession(context)

  if (!canDeleteOwnAccount && !canDeleteAsCmsAdmin) {
    throw new Error('Cannot delete another member account')
  }

  return (await context.sudo().db.Member.updateOne({
    where: { id: String(member.id) },
    data: { status: 'deleted' },
  })) as MemberRecord | null
}
