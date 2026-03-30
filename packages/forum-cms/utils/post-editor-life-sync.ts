import type { KeystoneContext } from '@keystone-6/core/types'

type PrismaLike = KeystoneContext['prisma']

/**
 * 依 Post 上 isEditorChoice／isLifeGuide 與 EditorChoice／LifeGuide 子表互相對齊。
 */
export async function reconcileEditorChoiceAndLifeGuideFromPostFlags(
  prisma: PrismaLike,
  postId: number,
  isEditorChoice: boolean,
  isLifeGuide: boolean
): Promise<void> {
  const ec = await prisma.editorChoice.count({ where: { postId } })
  if (isEditorChoice && ec === 0) {
    await prisma.editorChoice.create({
      data: { postId, sortOrder: 0 },
    })
  } else if (!isEditorChoice && ec > 0) {
    await prisma.editorChoice.deleteMany({ where: { postId } })
  }

  const lg = await prisma.lifeGuide.count({ where: { postId } })
  if (isLifeGuide && lg === 0) {
    await prisma.lifeGuide.create({
      data: { postId, sortOrder: 0 },
    })
  } else if (!isLifeGuide && lg > 0) {
    await prisma.lifeGuide.deleteMany({ where: { postId } })
  }
}

export async function syncPostIsEditorChoiceFromEditorChoices(
  prisma: PrismaLike,
  postId: number | null | undefined
): Promise<void> {
  if (postId == null || !Number.isFinite(postId)) return
  const n = await prisma.editorChoice.count({ where: { postId } })
  await prisma.post.update({
    where: { id: postId },
    data: { isEditorChoice: n > 0 },
  })
}

export async function syncPostIsLifeGuideFromLifeGuides(
  prisma: PrismaLike,
  postId: number | null | undefined
): Promise<void> {
  if (postId == null || !Number.isFinite(postId)) return
  const n = await prisma.lifeGuide.count({ where: { postId } })
  await prisma.post.update({
    where: { id: postId },
    data: { isLifeGuide: n > 0 },
  })
}
