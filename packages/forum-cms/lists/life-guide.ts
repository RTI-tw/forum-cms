import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { integer, relationship } from '@keystone-6/core/fields'
import { syncPostIsLifeGuideFromLifeGuides } from '../utils/post-editor-life-sync'

function getPostIdFromItem(
  item: Record<string, unknown> | null | undefined
): number | null {
  if (!item) return null
  const pid = item.postId as number | null | undefined
  if (pid != null) return pid
  const p = item.post as { id?: number } | null | undefined
  return p?.id ?? null
}

const listConfigurations = list({
  fields: {
    post: relationship({
      ref: 'Post.lifeGuides',
      many: false,
      label: '文章',
      ui: {
        views: './lists/views/life-guide-post/index',
        description:
          '僅列出已在文章頁勾選「生活須知」的文章；若找不到請先至該文章開啟此選項。',
      },
    }),
    sortOrder: integer({
      label: '顯示順序',
      defaultValue: 0,
    }),
  },
  ui: {
    label: '生活須知',
    listView: {
      initialColumns: ['post', 'sortOrder'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin),
    },
  },
  hooks: {
    validateInput: async ({
      resolvedData,
      addValidationError,
      context,
      operation,
    }) => {
      if (operation !== 'create' && operation !== 'update') return
      const rel = resolvedData.post as
        | { connect?: { id: string } }
        | undefined
      const id =
        rel?.connect?.id != null ? Number(rel.connect.id) : undefined
      if (id == null || !Number.isFinite(id)) return
      const post = await context.prisma.post.findUnique({
        where: { id },
        select: { isLifeGuide: true },
      })
      if (!post?.isLifeGuide) {
        addValidationError(
          '僅能選擇已在文章頁勾選「生活須知」的文章；請先至文章開啟該選項後再選擇。'
        )
      }
    },
    afterOperation: async ({ operation, item, originalItem, context }) => {
      if (operation === 'create' || operation === 'update') {
        const postId = getPostIdFromItem(item as Record<string, unknown>)
        await syncPostIsLifeGuideFromLifeGuides(context.prisma, postId)
        if (operation === 'update' && originalItem) {
          const prev = getPostIdFromItem(
            originalItem as Record<string, unknown>
          )
          if (prev !== postId) {
            await syncPostIsLifeGuideFromLifeGuides(context.prisma, prev)
          }
        }
      } else if (operation === 'delete' && originalItem) {
        const postId = getPostIdFromItem(
          originalItem as Record<string, unknown>
        )
        await syncPostIsLifeGuideFromLifeGuides(context.prisma, postId)
      }
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
