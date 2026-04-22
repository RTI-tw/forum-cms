/**
 * CMS 角色與內容審核規則（Admin / Editor）：
 * - 非目前 CMS 使用者 OfficialMapping 對應前台會員之貼文／留言：
 *   **不可**透過後台修改使用者貼上的**原文標題與內文**
 *   （Post：`title`、`content`；Comment：`content`）；譯文、原始語言、狀態、旗標、主圖、關聯等其餘欄位可更新。
 * - 投票：僅可改譯文，不可改說明／選項原文／票數（仍以白名單實作）。
 *
 * 僅在部署環境 **ACCESS_CONTROL_STRATEGY=cms**（預設值）時生效；
 * `gql` / `preview` / `api` 等不套用此檔內任何欄位過濾。
 */
import type { KeystoneContext } from '@keystone-6/core/types'

import envVar from '../environment-variables'
import {
  getOfficialMemberIdForSessionUser,
  getSessionUserId,
} from './official-member-from-session'

/** 與 `environment-variables` 的 `accessControlStrategy` 一致：僅 `cms` 時啟用本檔審核邏輯 */
function isCmsContentModerationActive(): boolean {
  return envVar.accessControlStrategy === 'cms'
}

/** 目前是否為已登入之 CMS User（Keystone session） */
export function isCmsUserSession(context: KeystoneContext): boolean {
  return getSessionUserId(context) !== null
}

/** 非官方作者貼文：鎖使用者原文「標題／內文」；譯文為 title_* / content_* */
const POST_UPDATE_DENIED_NON_OFFICIAL_ORIGINAL = new Set(['title', 'content'])

/** 非官方作者留言：鎖使用者原文「內文」；譯文為 content_* */
const COMMENT_UPDATE_DENIED_NON_OFFICIAL_ORIGINAL = new Set(['content'])

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

function omitKeys<T extends Record<string, unknown>>(
  data: T,
  denied: Set<string>
): T {
  const out = { ...data }
  for (const key of denied) {
    delete out[key]
  }
  return out
}

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

async function canEditMappedMemberContent(
  context: KeystoneContext,
  member: { id: number } | null | undefined
): Promise<boolean> {
  if (!member?.id) {
    return false
  }

  const officialMemberId = await getOfficialMemberIdForSessionUser(context)
  return officialMemberId != null && officialMemberId === member.id
}

export async function applyPostUpdateCmsRules(
  context: KeystoneContext,
  operation: string,
  item: { id?: unknown } | undefined,
  resolvedData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!isCmsContentModerationActive()) {
    return resolvedData
  }
  if (operation !== 'update' || !item?.id) {
    return resolvedData
  }
  const postId =
    typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10)
  if (Number.isNaN(postId)) return resolvedData

  const post = await context.prisma.post.findUnique({
    where: { id: postId },
    include: { author: { select: { id: true } } },
  })
  if (await canEditMappedMemberContent(context, post?.author)) {
    return resolvedData
  }
  return omitKeys(resolvedData, POST_UPDATE_DENIED_NON_OFFICIAL_ORIGINAL)
}

export async function applyCommentUpdateCmsRules(
  context: KeystoneContext,
  operation: string,
  item: { id?: unknown } | undefined,
  resolvedData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!isCmsContentModerationActive()) {
    return resolvedData
  }
  if (operation !== 'update' || !item?.id) {
    return resolvedData
  }
  const commentId =
    typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10)
  if (Number.isNaN(commentId)) return resolvedData

  const row = await context.prisma.comment.findUnique({
    where: { id: commentId },
    include: { member: { select: { id: true } } },
  })
  if (await canEditMappedMemberContent(context, row?.member)) {
    return resolvedData
  }
  return omitKeys(resolvedData, COMMENT_UPDATE_DENIED_NON_OFFICIAL_ORIGINAL)
}

export function applyPollUpdateTranslationOnly(
  resolvedData: Record<string, unknown>
): Record<string, unknown> {
  if (!isCmsContentModerationActive()) {
    return resolvedData
  }
  return pickKeys(resolvedData, POLL_UPDATE_TRANSLATION_ONLY)
}

export function applyPollOptionUpdateTranslationOnly(
  resolvedData: Record<string, unknown>
): Record<string, unknown> {
  if (!isCmsContentModerationActive()) {
    return resolvedData
  }
  return pickKeys(resolvedData, POLL_OPTION_UPDATE_TRANSLATION_ONLY)
}
