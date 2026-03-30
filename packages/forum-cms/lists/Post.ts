import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import {
    text,
    relationship,
    select,
    float,
    timestamp,
    checkbox,
    integer,
} from '@keystone-6/core/fields'
import { createMessageServicesTranslationHook } from '../utils/message-services-translation-hook'
import {
    getOfficialMemberIdForSessionUser,
    hasExplicitMemberRelationInput,
} from '../utils/official-member-from-session'
import { reconcileEditorChoiceAndLifeGuideFromPostFlags } from '../utils/post-editor-life-sync'

const translationAfterPost = createMessageServicesTranslationHook('post')

function normText(value: unknown): string {
    return String(value ?? '').trim()
}

/**
 * 欄位對應需求：標題原文（必填、≤80 字）、五語標題、貼文原文（必填）、五語內容、
 * 原始語言（必填）、作者（央廣後台預設 OfficialMapping 會員）、發文時間、已編輯、IP、SPAM、
 * 精選／生活須知（checkbox，並與 EditorChoice／LifeGuide 子表同步）、主題（必填）、狀態、多張主圖、關聯影片、
 * 投票、留言、留言數、反應、反應數、檢舉。留言數／反應數由 Comment／Reaction 的 hook 同步。
 */
const listConfigurations = list({
    fields: {
        title: text({
            validation: {
                isRequired: true,
                length: { max: 80 },
            },
            label: '標題（原文）',
            ui: {
                description: '必填，最多 80 字（含空格與標點）。',
            },
        }),
        title_zh: text({
            label: '標題（中文）',
            ui: { displayMode: 'textarea' },
        }),
        title_en: text({
            label: '標題（英文）',
            ui: { displayMode: 'textarea' },
        }),
        title_vi: text({
            label: '標題（越南文）',
            ui: { displayMode: 'textarea' },
        }),
        title_id: text({
            label: '標題（印尼文）',
            ui: { displayMode: 'textarea' },
        }),
        title_th: text({
            label: '標題（泰文）',
            ui: { displayMode: 'textarea' },
        }),
        content: text({
            validation: { isRequired: true },
            label: '貼文原文',
            ui: { displayMode: 'textarea' },
        }),
        language: select({
            label: '原始語言（使用者設定語言）',
            type: 'enum',
            validation: { isRequired: true },
            options: [
                { label: '中文', value: 'zh' },
                { label: 'English', value: 'en' },
                { label: 'Tiếng Việt', value: 'vi' },
                { label: 'Bahasa Indonesia', value: 'id' },
                { label: 'ภาษาไทย', value: 'th' },
            ],
        }),
        content_zh: text({
            label: '貼文（中文）',
            ui: { displayMode: 'textarea' },
        }),
        content_en: text({
            label: '貼文（英文）',
            ui: { displayMode: 'textarea' },
        }),
        content_vi: text({
            label: '貼文（越南文）',
            ui: { displayMode: 'textarea' },
        }),
        content_id: text({
            label: '貼文（印尼文）',
            ui: { displayMode: 'textarea' },
        }),
        content_th: text({
            label: '貼文（泰文）',
            ui: { displayMode: 'textarea' },
        }),
        author: relationship({
            ref: 'Member.posts',
            many: false,
            label: '作者',
            ui: {
                description:
                    '必填。央廣後台發文若未指定，將預設為 OfficialMapping 對應之會員帳號。',
            },
        }),
        published_date: timestamp({
            label: '發文時間',
            defaultValue: { kind: 'now' },
            db: { isNullable: true },
            ui: {
                description: '建立時由系統帶入，可於後台調整。',
                createView: { fieldMode: 'hidden' },
                itemView: { fieldMode: 'read' },
                listView: { fieldMode: 'read' },
            },
        }),
        is_edited: checkbox({
            label: '已編輯',
            defaultValue: false,
        }),
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
        isEditorChoice: checkbox({
            label: '編輯精選',
            defaultValue: false,
            ui: {
                description:
                    '勾選後會對應「編輯精選」列表（可至該處調整顯示順序）。',
            },
        }),
        isLifeGuide: checkbox({
            label: '生活須知',
            defaultValue: false,
            ui: {
                description:
                    '勾選後會對應「生活須知」列表（可至該處調整顯示順序）。',
            },
        }),
        editorChoices: relationship({
            ref: 'EditorChoice.post',
            many: true,
            label: '編輯精選（關聯）',
            ui: {
                createView: { fieldMode: 'hidden' },
                itemView: { fieldMode: 'hidden' },
                listView: { fieldMode: 'hidden' },
            },
        }),
        lifeGuides: relationship({
            ref: 'LifeGuide.post',
            many: true,
            label: '生活須知（關聯）',
            ui: {
                createView: { fieldMode: 'hidden' },
                itemView: { fieldMode: 'hidden' },
                listView: { fieldMode: 'hidden' },
            },
        }),
        topic: relationship({
            ref: 'Topic.posts',
            many: false,
            label: '主題分類',
            validation: { isRequired: true },
            ui: {
                description: '必填。',
            },
        }),
        status: select({
            label: '發布狀態',
            type: 'enum',
            options: [
                { label: 'Published', value: 'published' },
                { label: 'Draft', value: 'draft' },
                { label: 'Archived', value: 'archived' },
                { label: 'Hidden', value: 'hidden' },
            ],
            defaultValue: 'draft',
        }),
        heroImages: relationship({
            ref: 'Photo.postsAsHeroImages',
            many: true,
            label: '主圖',
            ui: {
                description: '可關聯多張圖片。',
                displayMode: 'cards',
                cardFields: ['name', 'urlOriginal'],
                linkToItem: true,
            },
        }),
        videos: relationship({
            ref: 'Video.post',
            many: true,
            label: '關聯影片',
        }),
        poll: relationship({
            ref: 'Poll.post',
            many: false,
            label: '投票',
        }),
        comments: relationship({
            ref: 'Comment.post',
            many: true,
            label: '留言',
        }),
        commentCount: integer({
            label: '留言數',
            defaultValue: 0,
            ui: {
                description: '由留言建立／刪除時自動重算。',
                createView: { fieldMode: 'hidden' },
                itemView: { fieldMode: 'read' },
                listView: { fieldMode: 'read' },
            },
        }),
        reactions: relationship({
            ref: 'Reaction.post',
            many: true,
            label: '反應',
        }),
        reactionCount: integer({
            label: '反應數',
            defaultValue: 0,
            ui: {
                description: '僅統計「對文章」的反應；由反應建立／刪除時自動重算。',
                createView: { fieldMode: 'hidden' },
                itemView: { fieldMode: 'read' },
                listView: { fieldMode: 'read' },
            },
        }),
        reports: relationship({
            ref: 'Report.post',
            many: true,
            label: '檢舉紀錄',
        }),
    },
    ui: {
        label: '文章',
        labelField: 'title',
        listView: {
            initialColumns: [
                'title',
                'author',
                'status',
                'commentCount',
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
        validateInput: ({ resolvedData, addValidationError, operation }) => {
            if (operation !== 'create' && operation !== 'update') return
            const title = normText(resolvedData.title)
            if (!title) {
                addValidationError('標題（原文）為必填')
            }
            if (title.length > 80) {
                addValidationError('標題（原文）最多 80 字')
            }
            if (!normText(resolvedData.content)) {
                addValidationError('貼文原文為必填')
            }
            if (resolvedData.language == null) {
                addValidationError('原始語言為必填')
            }
            const topicConnect =
                resolvedData.topic &&
                typeof resolvedData.topic === 'object' &&
                'connect' in resolvedData.topic &&
                (resolvedData.topic as { connect?: unknown }).connect
            if (!topicConnect) {
                addValidationError('主題分類為必填')
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
                    'author',
                )
                if (!explicit) {
                    const memberId =
                        await getOfficialMemberIdForSessionUser(context)
                    if (memberId != null) {
                        data.author = { connect: { id: memberId } }
                    }
                }
                if (!data.author?.connect) {
                    throw new Error(
                        '作者為必填：請選擇作者，或確認已以央廣後台帳號登入且已完成 OfficialMapping。'
                    )
                }
            }
            if (operation === 'update' && item) {
                const prev = item as {
                    title?: string | null
                    content?: string | null
                }
                const nextTitle =
                    data.title !== undefined ? String(data.title) : prev.title
                const nextContent =
                    data.content !== undefined
                        ? String(data.content)
                        : prev.content
                if (
                    prev.title !== nextTitle ||
                    prev.content !== nextContent
                ) {
                    data.is_edited = true
                }
            }
            return data
        },
        afterOperation: async (args) => {
            const { operation, item, context } = args
            if (
                (operation === 'create' || operation === 'update') &&
                item &&
                typeof (item as { id?: unknown }).id === 'number'
            ) {
                const rec = item as {
                    id: number
                    isEditorChoice?: boolean | null
                    isLifeGuide?: boolean | null
                }
                await reconcileEditorChoiceAndLifeGuideFromPostFlags(
                    context.prisma,
                    rec.id,
                    Boolean(rec.isEditorChoice),
                    Boolean(rec.isLifeGuide)
                )
            }
            await translationAfterPost(args)
        },
    },
})

export default utils.addTrackingFields(listConfigurations)
