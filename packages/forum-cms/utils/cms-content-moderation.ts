/**
 * CMS 角色與內容審核規則（Admin / Editor）：
 * - 非官方作者之貼文：僅可改譯文、狀態與主圖等（見各 Set）
 * - 非官方作者之留言：可改譯文、狀態、暫停自動翻譯；**原文 content／language 亦允許**（供後台修正錯字、違規內容並觸發 message-services 翻譯）
 * - 投票：僅可改譯文，不可改說明／選項原文／票數
 *
 * 僅在部署環境 **ACCESS_CONTROL_STRATEGY=cms**（預設值）時生效；
 * `gql` / `preview` / `api` 等不套用此檔內任何欄位過濾。
 */
import type { KeystoneContext } from '@keystone-6/core/types'

import envVar from '../environment-variables'
import { getSessionUserId } from './official-member-from-session'

/** 與 `environment-variables` 的 `accessControlStrategy` 一致：僅 `cms` 時啟用本檔審核邏輯 */
function isCmsContentModerationActive(): boolean {
  return envVar.accessControlStrategy === 'cms'
}

/** 目前是否為已登入之 CMS User（Keystone session） */
export function isCmsUserSession(context: KeystoneContext): boolean {
  return getSessionUserId(context) !== null
}

/** 非官方作者貼文 update 時允許變更的欄位（含前台顯示狀態） */
const POST_UPDATE_ALLOWED_NON_OFFICIAL = new Set([
  'status',
  // Allow CMS editors to mark posts into EditorChoice candidates.
  'isEditorChoice',
  /** 主圖 M2M：updatePost 的 connect / disconnect / set 皆經此欄位寫入 */
  'heroImages',
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

/** 非官方作者留言 update 時允許變更的欄位（含原文，否則無法寫入 DB、翻譯 hook 也不會觸發） */
const COMMENT_UPDATE_ALLOWED_NON_OFFICIAL = new Set([
  'status',
  'content',
  'language',
  'pauseAutoTranslation',
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
