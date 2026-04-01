import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { integer, relationship, select } from '@keystone-6/core/fields'
import { editorChoiceStateFromPostStatus } from '../utils/sync-editor-choice-state'

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
    state: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: '有效（文章為已發布）', value: 'active' },
        { label: '失效（文章非已發布或未關聯）', value: 'inactive' },
      ],
      defaultValue: 'inactive',
      graphql: {
        omit: {
          create: true,
          update: true,
        },
      },
      ui: {
        description:
          '依關聯文章是否為「已發布」自動更新；文章改為草稿等狀態時會變為失效。無法手動修改。',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        listView: { fieldMode: 'read' },
      },
    }),
  },
  ui: {
    label: '編輯精選',
    listView: {
      initialColumns: ['post', 'state', 'sortOrder'],
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
    resolveInput: async ({ resolvedData, operation, item, context }) => {
      const data = { ...resolvedData } as Record<string, unknown>
      const postRel = data.post as
        | { connect?: { id: string }; disconnect?: boolean }
        | undefined

      if (postRel?.disconnect === true) {
        data.state = 'inactive'
        return data
      }

      let postId: number | undefined
      if (postRel?.connect?.id != null) {
        postId = Number(postRel.connect.id)
      } else if (operation === 'update' && item) {
        postId = (item as { postId?: number | null }).postId ?? undefined
      }

      if (postId != null && Number.isFinite(postId)) {
        const post = await context.prisma.post.findUnique({
          where: { id: postId },
          select: { status: true },
        })
        data.state = editorChoiceStateFromPostStatus(post?.status ?? undefined)
      } else {
        data.state = 'inactive'
      }
      return data
    },
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
