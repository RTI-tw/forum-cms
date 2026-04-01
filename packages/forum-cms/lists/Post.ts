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
import { getClientIpFromKeystoneContext } from '../utils/client-ip'

const translationAfterPost = createMessageServicesTranslationHook('post')

function normText(value: unknown): string {
    return String(value ?? '').trim()
}

/** Keystone many 關聯：connect 可為單筆或陣列；亦可能用 set / create。 */
function hasAtLeastOneTopicRelation(topics: unknown): boolean {
    if (topics == null || typeof topics !== 'object') return false
    const t = topics as Record<string, unknown>
    if (t.connect != null) {
        const c = t.connect
        if (Array.isArray(c)) return c.length > 0
        if (typeof c === 'object' && c !== null && 'id' in c) return true
    }
    if (Array.isArray(t.set) && t.set.length > 0) return true
    if (Array.isArray(t.create) && t.create.length > 0) return true
    return false
}

/**
 * 欄位對應需求：標題原文（必填、≤80 字）、五語標題、貼文原文（必填）、五語內容、
 * 原始語言（必填）、作者（央廣後台預設 OfficialMapping 會員）、發文時間、已編輯、IP、SPAM、
 * 編輯精選／生活須知（checkbox 旗標）、主題（必填，可多選）、狀態、主圖（多張 Photo）、關聯影片、
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
                description:
                    '建立時預設為現在時間；建立／編輯時皆可手動調整。',
                createView: { fieldMode: 'edit' },
                itemView: { fieldMode: 'edit' },
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
                    '勾選後，該文章會出現在「編輯精選」列表建立文章時的可選清單；實際上榜請至「編輯精選」新增並設定順序。',
            },
        }),
        isLifeGuide: checkbox({
            label: '生活須知',
            defaultValue: false,
            ui: {
                description: '生活須知相關旗標（僅標記於文章，供前台或 API 使用）。',
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
        topics: relationship({
            ref: 'Topic.posts',
            many: true,
            label: '主題分類',
            ui: {
                description: '必填，至少選擇一個主題；可選多個。',
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
                description: '可關聯多張圖片；建立與編輯單篇時皆可調整。',
                displayMode: 'cards',
                cardFields: ['name', 'urlOriginal'],
                linkToItem: true,
                /** cards 模式在「尚未選任何圖」時必須開啟，否則 Admin 不會出現連結既有圖片的 UI */
                inlineConnect: true,
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
            const isCreate = operation === 'create'
            // update 時 Keystone 只帶入有變更的欄位；未出現在 resolvedData 代表沿用原值，不可當成「未填」。
            if (isCreate || resolvedData.title !== undefined) {
                const title = normText(resolvedData.title)
                if (!title) {
                    addValidationError('標題（原文）為必填')
                } else if (title.length > 80) {
                    addValidationError('標題（原文）最多 80 字')
                }
            }
            if (isCreate || resolvedData.content !== undefined) {
                if (!normText(resolvedData.content)) {
                    addValidationError('貼文原文為必填')
                }
            }
            if (isCreate || resolvedData.language !== undefined) {
                if (resolvedData.language == null) {
                    addValidationError('原始語言為必填')
                }
            }
            if (operation === 'create') {
                if (!hasAtLeastOneTopicRelation(resolvedData.topics)) {
                    addValidationError('主題分類為必填（至少選擇一個）')
                }
            } else if (
                operation === 'update' &&
                resolvedData.topics !== undefined
            ) {
                const td = resolvedData.topics as Record<string, unknown>
                if (
                    td.set !== undefined &&
                    Array.isArray(td.set) &&
                    td.set.length === 0
                ) {
                    addValidationError('主題分類至少需保留一個')
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
                // CMS 建立文章時由請求帶入發文 IP（表單未送或空白則補上）
                if (!normText(data.ip)) {
                    data.ip = getClientIpFromKeystoneContext(context)
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
            await translationAfterPost(args)
        },
    },
})

export default utils.addTrackingFields(listConfigurations)
