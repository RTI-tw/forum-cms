import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship, select, timestamp } from '@keystone-6/core/fields'

/**
 * 檢舉規格（欄位對應）：
 * - 檢舉文章 / 檢舉留言：擇一（建立時不可皆空、不可同時指定）
 * - 檢舉時間：對應追蹤欄位 createdAt（覆寫標籤為「檢舉時間」）
 * - 檢舉人、檢舉人 IP、檢舉原因、處理狀態、管理員處理備註
 *
 * 成立檢舉：**Resolved** 時，將被檢舉的 **Post.status** 或 **Comment.status** 設為 **hidden**（與 Post／Comment 狀態列舉一致）。
 * **留言（Comment）**：若之後將檢舉自 **Resolved** 改為 **Pending／Dismissed**，將該留言恢復為 **published**（駁回或重審時不再隱藏）。
 * Post 僅在成立時設為 hidden；自 Resolved 改回時不強制改回（避免誤將 draft 改為 published）。
 */
const listConfigurations = list({
  fields: {
    post: relationship({
      ref: 'Post.reports',
      many: false,
      label: '檢舉文章',
      ui: {
        description: '檢舉「文章」時選擇；與「檢舉留言」擇一即可。',
      },
    }),
    comment: relationship({
      ref: 'Comment.reports',
      many: false,
      label: '檢舉留言',
      ui: {
        description: '檢舉「留言」時選擇；與「檢舉文章」擇一即可。',
      },
    }),
    reporter: relationship({
      ref: 'Member',
      many: false,
      label: '檢舉人',
    }),
    ip: text({ label: '檢舉人 IP' }),
    reason: text({
      label: '檢舉原因',
      ui: { displayMode: 'textarea' },
    }),
    status: select({
      label: '處理狀態',
      type: 'enum',
      options: [
        {
          label: 'Pending（待處理）',
          value: 'pending',
        },
        {
          label: 'Resolved（已處理／成立）',
          value: 'resolved',
        },
        {
          label: 'Dismissed（已駁回）',
          value: 'dismissed',
        },
      ],
      defaultValue: 'pending',
      ui: {
        description:
          'Resolved：被檢舉文章／留言會設為 Hidden。若將 Resolved 改為 Dismissed／Pending，被檢舉留言會恢復為 Published（文章不自動還原）。',
      },
    }),
    adminNotes: text({
      label: '管理員處理備註',
      ui: { displayMode: 'textarea' },
    }),
  },
  ui: {
    label: '檢舉管理',
    listView: {
      initialColumns: [
        'createdAt',
        'post',
        'comment',
        'reporter',
        'ip',
        'reason',
        'status',
      ],
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
    validateInput: ({ resolvedData, addValidationError, operation }) => {
      if (operation !== 'create') return
      const hasPost = Boolean(
        resolvedData.post &&
          typeof resolvedData.post === 'object' &&
          'connect' in resolvedData.post &&
          resolvedData.post.connect
      )
      const hasComment = Boolean(
        resolvedData.comment &&
          typeof resolvedData.comment === 'object' &&
          'connect' in resolvedData.comment &&
          resolvedData.comment.connect
      )
      if (!hasPost && !hasComment) {
        addValidationError(
          '請指定「檢舉文章」或「檢舉留言」其中一項。'
        )
      }
      if (hasPost && hasComment) {
        addValidationError(
          '請只指定「檢舉文章」或「檢舉留言」其中一項，勿同時填寫。'
        )
      }
    },
    afterOperation: async ({ operation, item, originalItem, context }) => {
      if (operation === 'delete') return

      const row = item as {
        id?: number
        status?: string | null
        postId?: number | null
        commentId?: number | null
        post?: { id?: number } | null
        comment?: { id?: number } | null
      }

      const prevStatus =
        originalItem != null
          ? (originalItem as { status?: string | null }).status
          : undefined
      const nextStatus = row.status ?? undefined

      const postId = row.postId ?? row.post?.id ?? null
      const commentId = row.commentId ?? row.comment?.id ?? null

      /** 新變成「成立」：建立即 resolved，或由非 resolved 改為 resolved */
      const newlyResolved =
        nextStatus === 'resolved' &&
        (operation === 'create' || prevStatus !== 'resolved')

      /** 從「成立」改為其他狀態（駁回、待處理等）— 僅留言恢復為公開，與 Comment 狀態（published／archived／hidden）流程對應 */
      const leftResolved =
        operation === 'update' &&
        prevStatus === 'resolved' &&
        nextStatus !== 'resolved' &&
        nextStatus != null

      const prisma = context.prisma

      try {
        if (newlyResolved) {
          if (postId != null) {
            await prisma.post.update({
              where: { id: postId },
              data: { status: 'hidden' },
            })
          } else if (commentId != null) {
            await prisma.comment.update({
              where: { id: commentId },
              data: { status: 'hidden' },
            })
          }
        } else if (leftResolved && commentId != null) {
          await prisma.comment.update({
            where: { id: commentId },
            data: { status: 'published' },
          })
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message:
              '檢舉狀態變更後，同步 Post／Comment 狀態失敗',
            reportId: row.id,
            postId,
            commentId,
            newlyResolved,
            leftResolved,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          })
        )
      }
    },
  },
})

const withTracking = utils.addTrackingFields(listConfigurations)

withTracking.fields.createdAt = timestamp({
  label: '檢舉時間',
  ui: {
    createView: { fieldMode: 'hidden' },
    itemView: { fieldMode: 'read' },
    listView: { fieldMode: 'read' },
  },
})

export default withTracking
