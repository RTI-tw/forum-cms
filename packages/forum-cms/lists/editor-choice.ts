import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { integer, relationship } from '@keystone-6/core/fields'

function getResolvedSortOrder(
  resolvedData: Record<string, unknown>,
  operation: 'create' | 'update' | 'delete',
  item: unknown
): number {
  if (
    resolvedData.sortOrder !== undefined &&
    resolvedData.sortOrder !== null
  ) {
    return Number(resolvedData.sortOrder)
  }
  if (operation === 'update' && item) {
    return Number(
      (item as { sortOrder?: number | null }).sortOrder ?? 0
    )
  }
  return 0
}

const listConfigurations = list({
  fields: {
    post: relationship({
      ref: 'Post.editorChoices',
      many: false,
      label: '文章',
      ui: {
        views: './lists/views/editor-choice-post/index',
        description:
          '僅列出已在文章頁勾選「編輯精選」的文章；若找不到請先至該文章開啟此選項。',
      },
    }),
    sortOrder: integer({
      label: '顯示順序',
      defaultValue: 0,
    }),
  },
  ui: {
    label: '編輯精選',
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
      item,
    }) => {
      if (operation !== 'create' && operation !== 'update') return

      const sortOrder = getResolvedSortOrder(
        resolvedData as Record<string, unknown>,
        operation,
        item
      )
      if (!Number.isFinite(sortOrder)) {
        addValidationError('顯示順序必須為有效數字。')
        return
      }

      const conflict = await context.prisma.editorChoice.findFirst({
        where: {
          sortOrder,
          ...(operation === 'update' && item
            ? { NOT: { id: (item as { id: number }).id } }
            : {}),
        },
        select: { id: true },
      })
      if (conflict) {
        addValidationError(
          `顯示順序「${sortOrder}」已被其他編輯精選使用，請換一個不重複的數字。`
        )
        return
      }

      const rel = resolvedData.post as
        | { connect?: { id: string } }
        | undefined
      const id =
        rel?.connect?.id != null ? Number(rel.connect.id) : undefined
      if (id == null || !Number.isFinite(id)) return
      const post = await context.prisma.post.findUnique({
        where: { id },
        select: { isEditorChoice: true },
      })
      if (!post?.isEditorChoice) {
        addValidationError(
          '僅能選擇已在文章頁勾選「編輯精選」的文章；請先至文章開啟該選項後再選擇。'
        )
      }
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
