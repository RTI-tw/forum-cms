import type { KeystoneContext } from '@keystone-6/core/types'

export type EditorChoiceStateValue = 'active' | 'inactive'

/** 內容 status 為 published 時編輯精選為 active，否則為 inactive。 */
export function editorChoiceStateFromContentStatus(
  status: string | null | undefined
): EditorChoiceStateValue {
  return status === 'published' ? 'active' : 'inactive'
}

/** 文章 status 為 published 時編輯精選為 active，否則為 inactive */
export function editorChoiceStateFromPostStatus(
  status: string | null | undefined
): EditorChoiceStateValue {
  return editorChoiceStateFromContentStatus(status)
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

/**
 * 依指定 Event 目前 status，更新所有指向該活動的 EditorChoice.state。
 * Event 發布狀態變更時由 Event.afterOperation 呼叫。
 */
export async function syncEditorChoiceStateForEventId(
  context: KeystoneContext,
  eventId: number
): Promise<void> {
  const event = await context.prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true },
  })
  const state = editorChoiceStateFromContentStatus(event?.status ?? undefined)
  await context.prisma.editorChoice.updateMany({
    where: { eventId },
    data: { state },
  })
}
