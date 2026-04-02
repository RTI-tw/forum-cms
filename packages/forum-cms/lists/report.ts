import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship, select, timestamp } from '@keystone-6/core/fields'

/**
 * 檢舉規格（欄位對應）：
 * - 檢舉文章 / 檢舉留言：擇一（建立時不可皆空、不可同時指定）
 * - 檢舉時間：`createdAt`（列表與單筆顯示為「檢舉時間」）
 * - 處理狀態：`pending` / `resolved` / `dismissed`（見下方「成立認定」）
 * - 檢舉人、檢舉人 IP、檢舉原因、管理員處理備註
 *
 * 【待確認之結論／實作行為】管理員「認定檢舉成立」時，請將檢舉設為 **Resolved（已處理／成立）**。
 * 系統在 **Resolved** 時會自動把被檢舉的 **Post** 或 **Comment** 的 `status` 設為 **hidden**（前台隱藏）。
 *
 * - **留言**：若之後將檢舉自 **Resolved** 改為 **Pending／Dismissed**，該留言會恢復為 **published**（駁回或重審時不再隱藏）。
 * - **文章**：成立時設為 hidden；自 Resolved 改回 **Pending／Dismissed** 時**不**自動還原文章狀態（避免誤把草稿等改回 published）。
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
          label: 'Resolved（成立：隱藏該文章／留言）',
          value: 'resolved',
        },
        {
          label: 'Dismissed（駁回：不成立）',
          value: 'dismissed',
        },
      ],
      defaultValue: 'pending',
      ui: {
        description:
          '認定檢舉成立請選「Resolved」：系統會將被檢舉文章或留言設為 Hidden。改為 Dismissed／Pending 時，僅留言會自動恢復為 Published；文章不會自動還原。',
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
        'status',
        'post',
        'comment',
        'reporter',
        'reason',
        'ip',
      ],
      initialSort: { field: 'createdAt', direction: 'DESC' },
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
