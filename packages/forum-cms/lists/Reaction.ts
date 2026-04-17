import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import {
    syncPostCommentAndReactionCounts,
    syncCommentReactionCount,
} from '../utils/post-count-sync'
import {
    relationship,
    select,
    timestamp,
} from '@keystone-6/core/fields'

const listConfigurations = list({
    fields: {
        member: relationship({ ref: 'Member.reactions', many: false, label: '會員' }),
        post: relationship({ ref: 'Post.reactions', many: false, label: '文章' }),
        comment: relationship({ ref: 'Comment.reactions', many: false, label: '留言' }),
        type: select({
            label: '心情類型',
            type: 'enum',
            options: [
                { label: 'Love', value: 'love' },
                { label: 'Like', value: 'like' },
                { label: 'Haha', value: 'haha' },
                { label: 'Sad', value: 'sad' },
                { label: 'Angry', value: 'angry' },
                { label: 'Scared', value: 'scared' },
                { label: 'Wow', value: 'wow' },
            ],
            validation: { isRequired: true },
        }),
        createdAt: timestamp({
            defaultValue: { kind: 'now' },
            label: '建立時間',
        }),
    },
    ui: {
        label: '反應',
        listView: {
            initialColumns: ['member', 'type', 'post', 'comment'],
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
        afterOperation: async ({ item, originalItem, context }) => {
            type R = { postId?: number | null; commentId?: number | null }
            const commentIds = new Set<number>()
            const pushComment = (r: R | null | undefined) => {
                const cid = r?.commentId
                if (cid != null && Number.isFinite(cid)) {
                    commentIds.add(cid)
                }
            }
            pushComment(originalItem as R | undefined)
            pushComment(item as R | undefined)
            for (const cid of commentIds) {
                await syncCommentReactionCount(context.prisma, cid)
            }

            const postIdsForPostLevelReaction = (r: R | null | undefined) => {
                if (!r?.postId) return []
                if (r.commentId != null) return []
                return [r.postId]
            }
            const ids = new Set<number>()
            for (const id of postIdsForPostLevelReaction(
                originalItem as R | undefined
            )) {
                ids.add(id)
            }
            for (const id of postIdsForPostLevelReaction(
                item as R | undefined
            )) {
                ids.add(id)
            }
            for (const id of ids) {
                await syncPostCommentAndReactionCounts(context.prisma, id)
            }
        },
    },
})

export default utils.addTrackingFields(listConfigurations)
