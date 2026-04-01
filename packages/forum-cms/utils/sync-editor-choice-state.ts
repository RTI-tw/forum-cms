import type { KeystoneContext } from '@keystone-6/core/types'

export type EditorChoiceStateValue = 'active' | 'inactive'

/** 文章 status 為 published 時編輯精選為 active，否則為 inactive */
export function editorChoiceStateFromPostStatus(
  status: string | null | undefined
): EditorChoiceStateValue {
  return status === 'published' ? 'active' : 'inactive'
}

/**
 * 依指定 Post 目前 status，更新所有指向該文章的 EditorChoice.state。
 * Post 發布狀態變更時由 Post.afterOperation 呼叫。
 */
export async function syncEditorChoiceStateForPostId(
  context: KeystoneContext,
  postId: number
): Promise<void> {
  const post = await context.prisma.post.findUnique({
    where: { id: postId },
    select: { status: true },
  })
  const state = editorChoiceStateFromPostStatus(post?.status ?? undefined)
  await context.prisma.editorChoice.updateMany({
    where: { postId },
    data: { state },
  })
}
