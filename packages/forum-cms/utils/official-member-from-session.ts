import type { KeystoneContext } from '@keystone-6/core/types'

/** 目前登入的 CMS User id（Keystone session），無則為 null */
export function getSessionUserId(context: KeystoneContext): number | null {
  const session = context.session as
    | { data?: { id?: unknown }; itemId?: unknown }
    | undefined
  if (!session) return null
  const raw =
    session.data?.id !== undefined && session.data?.id !== null
      ? session.data.id
      : session.itemId
  if (raw === undefined || raw === null) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isNaN(n) ? null : n
}

/**
 * 依 OfficialMapping：CMS User → 前台 Member。
 * 若同一 CMS 有多筆 mapping，取 id 最小的一筆（穩定、可預期）。
 */
export async function getOfficialMemberIdForSessionUser(
  context: KeystoneContext
): Promise<number | null> {
  const cmsUserId = getSessionUserId(context)
  if (cmsUserId === null) return null

  const row = await context.sudo().prisma.officialMapping.findFirst({
    where: { cmsUserId },
    orderBy: { id: 'asc' },
    select: { officialMemberId: true },
  })
  return row?.officialMemberId ?? null
}

/** 使用者是否在表單中明確指定了 relationship（connect / create） */
export function hasExplicitMemberRelationInput(
  inputData: Record<string, unknown> | undefined,
  fieldKey: 'author' | 'member'
): boolean {
  if (!inputData?.[fieldKey]) return false
  const v = inputData[fieldKey] as { connect?: unknown; create?: unknown }
  return !!(v.connect ?? v.create)
}
