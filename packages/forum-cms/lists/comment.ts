import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core';
import {
  text,
  relationship,
  timestamp,
  checkbox,
  select,
  float,
  integer,
} from '@keystone-6/core/fields';
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'
import { syncPostCommentAndReactionCounts } from '../utils/post-count-sync'
import {
  getOfficialMemberIdForSessionUser,
  hasExplicitMemberRelationInput,
} from '../utils/official-member-from-session'
import {
  applyCommentUpdateCmsRules,
  isCmsUserSession,
} from '../utils/cms-content-moderation'

const translationAfterComment =
  createMessageServicesTranslationHook('comment')

const listConfigurations = list({
  fields: {
    content: text({ validation: { isRequired: false }, label: '原文內容' }),
    language: select({
      label: '原始語言',
      type: 'enum',
      options: [
        { label: '中文', value: 'zh' },
        { label: 'English', value: 'en' },
        { label: 'Tiếng Việt', value: 'vi' },
        { label: 'Bahasa Indonesia', value: 'id' },
        { label: 'ภาษาไทย', value: 'th' },
      ],
    }),
    content_zh: text({
      label: '內容（中文）',
      ui: { displayMode: 'textarea' },
    }),
    content_en: text({
      label: '內容（英文）',
      ui: { displayMode: 'textarea' },
    }),
    content_vi: text({
      label: '內容（越南文）',
      ui: { displayMode: 'textarea' },
    }),
    content_id: text({
      label: '內容（印尼文）',
      ui: { displayMode: 'textarea' },
    }),
    content_th: text({
      label: '內容（泰文）',
      ui: { displayMode: 'textarea' },
    }),
    pauseAutoTranslation: checkbox({
      label: '暫停自動翻譯',
      defaultValue: false,
      ui: {
        description:
          '勾選後不會觸發 message-services 自動翻譯（內文五語）。可自行編輯譯文。',
      },
    }),
    post: relationship({ ref: 'Post.comments', many: false, label: '文章' }),
    member: relationship({ ref: 'Member.comment', many: false, label: '作者' }),
    ip: text({ label: '發文 IP' }),
    spamScore: float({
      label: 'SPAM 分數（0–1）',
      validation: { min: 0, max: 1 },
      db: { isNullable: true },
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'hidden' },
        listView: { fieldMode: 'hidden' },
      },
    }),
    status: select({
      label: '狀態',
      type: 'enum',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Deleted（已刪除）', value: 'deleted' },
      ],
      defaultValue: 'published',
      ui: {
        description:
          'Published：公開；Archived：封存；Hidden：隱藏；Deleted：已刪除。一般會員留言不可設為已刪除。',
      },
    }),
    reactions: relationship({ ref: 'Reaction.comment', many: true, label: '反應' }),
    reactionCount: integer({
      label: '反應數',
      defaultValue: 0,
      ui: {
        description: '對此留言的 Reaction 筆數；由反應建立／變更／刪除時自動重算。',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
        listView: { fieldMode: 'read' },
      },
    }),
    reports: relationship({ ref: 'Report.comment', many: true, label: '檢舉紀錄' }),
    published_date: timestamp({ validation: { isRequired: false }, label: '發布時間' }),
    is_edited: checkbox({
      defaultValue: false,
      label: '已編輯',
    }),
    is_active: checkbox({
      defaultValue: true,
      label: '啟用',
    }),
  },
  ui: {
    label: '留言',
    listView: {
      initialColumns: [
        'content',
        'member',
        'status',
        'reactionCount',
        'published_date',
      ],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },
  hooks: {
    validateInput: async ({
      resolvedData,
      addValidationError,
      operation,
      item,
      context,
    }) => {
      if (operation === 'create' && isCmsUserSession(context)) {
        addValidationError(
          '請於前台以官方帳號登入後留言，勿在 CMS 建立留言。',
        )
        return
      }
      if (operation === 'update' && resolvedData.status === 'deleted' && item?.id) {
        const commentId =
          typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10)
        if (!Number.isNaN(commentId)) {
          const row = await context.prisma.comment.findUnique({
            where: { id: commentId },
            include: { member: { select: { isOfficial: true } } },
          })
          if (row?.member && !row.member.isOfficial) {
            addValidationError(
              '一般會員留言不可設為「已刪除」；請使用隱藏／封存等狀態。',
            )
          }
        }
      }
    },
    resolveInput: async ({
      resolvedData,
      operation,
      context,
      inputData,
      item,
    }) => {
      const data = { ...resolvedData }
      if (operation === 'create') {
        const explicit = hasExplicitMemberRelationInput(
          inputData as Record<string, unknown>,
          'member',
        )
        if (!explicit) {
          const memberId = await getOfficialMemberIdForSessionUser(context)
          if (memberId != null) {
            data.member = { connect: { id: memberId } }
          }
        }
      }
      if (operation === 'update') {
        const noManualCount = { ...data } as Record<string, unknown>
        delete noManualCount.reactionCount
        const moderated = await applyCommentUpdateCmsRules(
          context,
          operation,
          item as { id?: unknown },
          noManualCount,
        )
        return moderated as typeof data
      }
      return data
    },
    afterOperation: async (args) => {
      await translationAfterComment(args)
      const { operation, item, originalItem, context } = args
      const getPostId = (
        r: Record<string, unknown> | null | undefined
      ): number | null => {
        if (!r) return null
        const pid = r.postId as number | null | undefined
        if (pid != null) return pid
        const p = r.post as { id?: number } | null | undefined
        return p?.id ?? null
      }
      const postId = getPostId(item as Record<string, unknown>)
      const prevPostId = getPostId(
        originalItem as Record<string, unknown> | undefined
      )

      if (operation === 'delete') {
        await syncPostCommentAndReactionCounts(
          context.prisma,
          prevPostId ?? postId
        )
        return
      }
      await syncPostCommentAndReactionCounts(context.prisma, postId)
      if (
        operation === 'update' &&
        prevPostId != null &&
        postId != null &&
        prevPostId !== postId
      ) {
        await syncPostCommentAndReactionCounts(context.prisma, prevPostId)
      }
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
