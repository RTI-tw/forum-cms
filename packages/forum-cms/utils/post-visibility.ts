import type { KeystoneContext } from '@keystone-6/core/types'

import envVar from '../environment-variables'
import { verifyMemberSession } from './member-session'
import { getSessionUserId } from './official-member-from-session'

type WhereInput = Record<string, unknown>

function getBearerToken(context: KeystoneContext): string | null {
  const authHeader = context.req?.headers?.authorization
  if (typeof authHeader !== 'string') return null
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

/**
 * 取得前台會員（Member）id；無效或未帶 token 時回傳 null。
 * 注意：CMS session 不使用這個流程，而由 getSessionUserId 判斷。
 */
export function getAuthenticatedMemberId(
  context: KeystoneContext
): number | null {
  const token = getBearerToken(context)
  if (!token) return null
  try {
    const payload = verifyMemberSession(token) as { memberId?: unknown }
    const raw = payload.memberId
    if (raw == null) return null
    const id = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
    return Number.isNaN(id) ? null : id
  } catch {
    return null
  }
}

export function isCmsRequest(context: KeystoneContext): boolean {
  return getSessionUserId(context) !== null || envVar.accessControlStrategy === 'cms'
}

/**
 * 文章可見性：
 * - published：所有人可見
 * - hidden：僅文章作者本人可見（memberId 必須相符）
 */
export function buildPostVisibilityWhere(memberId: number | null): WhereInput {
  if (memberId == null) {
    return { status: { equals: 'published' } }
  }
  return {
    OR: [
      { status: { equals: 'published' } },
      {
        AND: [
          { status: { equals: 'hidden' } },
          { author: { id: { equals: memberId } } },
        ],
      },
    ],
  }
}
