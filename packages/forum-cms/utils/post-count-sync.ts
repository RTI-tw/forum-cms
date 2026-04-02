import type { KeystoneContext } from '@keystone-6/core/types'

type PrismaLike = KeystoneContext['prisma']

/**
 * 依實際 Comment／Reaction 重算並寫入 Post.commentCount、Post.reactionCount。
 * 留言數：該文章下所有 Comment。
 * 反應數：僅統計「對文章」的反應（Reaction.post 有值且 comment 為空），不含對留言的反應。
 */
export async function syncPostCommentAndReactionCounts(
  prisma: PrismaLike,
  postId: number | null | undefined
): Promise<void> {
  if (postId == null || !Number.isFinite(postId)) return

  const [commentCount, reactionCount] = await Promise.all([
    prisma.comment.count({
      where: { postId },
    }),
    prisma.reaction.count({
      where: {
        postId,
        commentId: null,
      },
    }),
  ])

  await prisma.post.update({
    where: { id: postId },
    data: { commentCount, reactionCount },
  })
}

/** 依 Reaction 重算單一留言的 reactionCount（對該留言的 Reaction 筆數）。 */
export async function syncCommentReactionCount(
  prisma: PrismaLike,
  commentId: number | null | undefined
): Promise<void> {
  if (commentId == null || !Number.isFinite(commentId)) return

  const count = await prisma.reaction.count({
    where: { commentId },
  })

  await prisma.comment.update({
    where: { id: commentId },
    data: { reactionCount: count },
  })
}
