/**
 * CMS 角色與內容審核規則（Admin / Editor）：
 * - 非官方作者之貼文／留言：僅可改譯文與前台顯示狀態等欄位
 * - 投票：僅可改譯文，不可改說明／選項原文／票數
 */
import type { KeystoneContext } from '@keystone-6/core/types'

import { getSessionUserId } from './official-member-from-session'

/** 目前是否為已登入之 CMS User（Keystone session） */
export function isCmsUserSession(context: KeystoneContext): boolean {
  return getSessionUserId(context) !== null
}

/** 非官方作者貼文 update 時允許變更的欄位（含前台顯示狀態） */
const POST_UPDATE_ALLOWED_NON_OFFICIAL = new Set([
  'status',
  'title_zh',
  'title_en',
  'title_vi',
  'title_id',
  'title_th',
  'content_zh',
  'content_en',
  'content_vi',
  'content_id',
  'content_th',
])

/** 非官方作者留言 update 時允許變更的欄位 */
const COMMENT_UPDATE_ALLOWED_NON_OFFICIAL = new Set([
  'status',
  'content_zh',
  'content_en',
  'content_vi',
  'content_id',
  'content_th',
])

/** 投票 update 僅允許譯文標題 */
const POLL_UPDATE_TRANSLATION_ONLY = new Set([
  'title_zh',
  'title_en',
  'title_vi',
  'title_id',
  'title_th',
])

/** 投票選項 update 僅允許譯文 */
const POLL_OPTION_UPDATE_TRANSLATION_ONLY = new Set([
  'text_zh',
  'text_en',
  'text_vi',
  'text_id',
  'text_th',
])

function pickKeys<T extends Record<string, unknown>>(
  data: T,
  allowed: Set<string>
): T {
  const out = { ...data }
  for (const key of Object.keys(out)) {
    if (!allowed.has(key)) {
      delete out[key]
    }
  }
  return out
}

export async function applyPostUpdateCmsRules(
  context: KeystoneContext,
  operation: string,
  item: { id?: unknown } | undefined,
  resolvedData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (operation !== 'update' || !item?.id) {
    return resolvedData
  }
  const postId =
    typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10)
  if (Number.isNaN(postId)) return resolvedData

  const post = await context.prisma.post.findUnique({
    where: { id: postId },
    include: { author: { select: { isOfficial: true } } },
  })
  if (!post?.author || post.author.isOfficial) {
    return resolvedData
  }
  return pickKeys(resolvedData, POST_UPDATE_ALLOWED_NON_OFFICIAL)
}

export async function applyCommentUpdateCmsRules(
  context: KeystoneContext,
  operation: string,
  item: { id?: unknown } | undefined,
  resolvedData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (operation !== 'update' || !item?.id) {
    return resolvedData
  }
  const commentId =
    typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10)
  if (Number.isNaN(commentId)) return resolvedData

  const row = await context.prisma.comment.findUnique({
    where: { id: commentId },
    include: { member: { select: { isOfficial: true } } },
  })
  if (!row?.member || row.member.isOfficial) {
    return resolvedData
  }
  return pickKeys(resolvedData, COMMENT_UPDATE_ALLOWED_NON_OFFICIAL)
}

export function applyPollUpdateTranslationOnly(
  resolvedData: Record<string, unknown>
): Record<string, unknown> {
  return pickKeys(resolvedData, POLL_UPDATE_TRANSLATION_ONLY)
}

export function applyPollOptionUpdateTranslationOnly(
  resolvedData: Record<string, unknown>
): Record<string, unknown> {
  return pickKeys(resolvedData, POLL_OPTION_UPDATE_TRANSLATION_ONLY)
}
