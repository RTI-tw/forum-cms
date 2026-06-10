import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { integer, relationship, select } from '@keystone-6/core/fields'
import type { KeystoneContext } from '@keystone-6/core/types'
import { editorChoiceStateFromContentStatus } from '../utils/sync-editor-choice-state'

type ToOneRelationInput = {
  connect?: { id?: string | number | null }
  disconnect?: boolean
}

type EditorChoiceItem = {
  id?: number
  postId?: number | null
  eventId?: number | null
  sortOrder?: number | null
}

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

function toFiniteId(value: unknown): number | undefined {
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(id) ? id : undefined
}

function getResolvedRelationId(
  relationInput: ToOneRelationInput | undefined,
  currentId: number | null | undefined
): number | undefined {
  if (relationInput?.disconnect === true) return undefined
  const connectedId = toFiniteId(relationInput?.connect?.id)
  if (connectedId !== undefined) return connectedId
  return currentId ?? undefined
}

async function resolveEditorChoiceState(
  context: KeystoneContext,
  postId: number | undefined,
  eventId: number | undefined
): Promise<'active' | 'inactive'> {
  const hasPost = postId !== undefined
  const hasEvent = eventId !== undefined

  if (hasPost && !hasEvent) {
    const post = await context.prisma.post.findUnique({
      where: { id: postId },
      select: { status: true },
    })
    return editorChoiceStateFromContentStatus(post?.status ?? undefined)
  }

  if (hasEvent && !hasPost) {
    const event = await context.prisma.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    })
    return editorChoiceStateFromContentStatus(event?.status ?? undefined)
  }

  return 'inactive'
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
    event: relationship({
      ref: 'Event.editorChoices',
      many: false,
      label: '活動',
      ui: {
        hideCreate: true,
        description:
          '可選擇活動作為編輯精選；活動為 Published 時精選狀態會自動變為有效。',
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
        { label: '有效（文章或活動為已發布）', value: 'active' },
        { label: '失效（文章或活動非已發布或未關聯）', value: 'inactive' },
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
          '依關聯文章或活動是否為「已發布」自動更新；改為草稿等狀態時會變為失效。無法手動修改。',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        listView: { fieldMode: 'read' },
      },
    }),
  },
  ui: {
    label: '編輯精選',
    listView: {
      initialColumns: ['post', 'event', 'state', 'sortOrder'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
  },
  hooks: {
    resolveInput: async ({ resolvedData, operation, item, context }) => {
      const data = { ...resolvedData } as Record<string, unknown>
      const postRel = data.post as
        | ToOneRelationInput
        | undefined
      const eventRel = data.event as
        | ToOneRelationInput
        | undefined
      const current =
        operation === 'update' && item ? (item as EditorChoiceItem) : undefined
      const postId = getResolvedRelationId(postRel, current?.postId)
      const eventId = getResolvedRelationId(eventRel, current?.eventId)

      data.state = await resolveEditorChoiceState(context, postId, eventId)
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

      const current =
        operation === 'update' && item ? (item as EditorChoiceItem) : undefined
      const postRel = resolvedData.post as
        | ToOneRelationInput
        | undefined
      const eventRel = resolvedData.event as
        | ToOneRelationInput
        | undefined
      const postId = getResolvedRelationId(postRel, current?.postId)
      const eventId = getResolvedRelationId(eventRel, current?.eventId)
      const hasPost = postId !== undefined
      const hasEvent = eventId !== undefined

      if (hasPost === hasEvent) {
        addValidationError('請選擇文章或活動其中一種，不能同時選擇或都不選。')
        return
      }

      const id = toFiniteId(postRel?.connect?.id)
      if (id === undefined) return
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
