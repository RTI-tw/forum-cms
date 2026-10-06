import type { KeystoneContext } from '@keystone-6/core/types'

import { getAuthenticatedMemberId } from './post-visibility'

export type PostWhereUniqueInput = {
  id?: string | number | null
}

type PostOwnershipRecord = {
  id: number
  status?: string | null
  authorId?: number | null
}

function normalizePostId(where: PostWhereUniqueInput | null | undefined) {
  const raw = where?.id
  if (raw == null || String(raw).trim().length === 0) {
    throw new Error('Post identifier is required')
  }

  const id = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isInteger(id)) {
    throw new Error('Post identifier is invalid')
  }

  return id
}

/**
 * 前台「刪除貼文」＝軟刪除：只把作者本人的文章狀態改成 archived。
 * 後台（CMS）仍保留 Keystone 產生的 deletePost／deletePosts 硬刪除，方便央廣清測試資料。
 *
 * 走 db API（而非直接 prisma）寫入，才會觸發 Post 的 afterOperation：
 * 重算精選狀態並通知 cron-services 重出 JSON，讓貼文立刻離開首頁／各 feed。
 */
export async function archiveMemberPostByWhere(
  context: KeystoneContext,
  where: PostWhereUniqueInput
) {
  const postId = normalizePostId(where)

  const memberId = getAuthenticatedMemberId(context)
  if (memberId == null) {
    throw new Error('Member session is required to delete a post')
  }

  const post = (await context.prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  })) as PostOwnershipRecord | null

  if (!post) {
    return null
  }

  if (post.authorId !== memberId) {
    throw new Error('Cannot delete another member post')
  }

  // 連點兩次／重送同一個 mutation 時不重複寫入。
  if (post.status === 'archived') {
    return context.sudo().db.Post.findOne({ where: { id: String(post.id) } })
  }

  return context.sudo().db.Post.updateOne({
    where: { id: String(post.id) },
    data: { status: 'archived' },
  })
}
