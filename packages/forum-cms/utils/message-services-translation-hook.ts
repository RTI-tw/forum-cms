import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

/** Keystone 的 afterOperation 可為函式或依操作分流物件；此 hook 僅為前者。 */
type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

/**
 * 與 message-services `KeystoneHookSyncTranslationRequest.type` 一致。
 * 新增類型時請同步更新 message-services：`/hooks/sync-translations` 的 handler、
 * Keystone 實體讀取與翻譯欄位寫回（word → word_zh … word_th 等）。
 */
export type MessageServicesEntityType =
  | 'post'
  | 'comment'
  | 'topic'
  | 'poll'
  | 'pollOption'
  | 'content'
  | 'forbiddenKeyword'

let warnedMissingMessageServicesUrl = false

function warnMissingMessageServicesUrlOnce() {
  if (warnedMissingMessageServicesUrl) return
  warnedMissingMessageServicesUrl = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message:
        'MESSAGE_SERVICES_URL 未設定，翻譯 hook 不會呼叫 message-services。請在部署環境設定此變數（message-services 根網址，勿結尾斜線）。',
      timestamp: new Date().toISOString(),
    })
  )
}

function normText(value: unknown): string {
  return String(value ?? '').trim()
}

function readMergedText(
  item: Record<string, unknown>,
  originalItem: Record<string, unknown> | null | undefined,
  key: string
): string {
  const nextRaw =
    item[key] !== undefined ? item[key] : originalItem ? originalItem[key] : ''
  return normText(nextRaw)
}

/** 建立／更新合併後讀取 boolean（未在 resolvedData 則沿用原 item） */
function readMergedBool(
  item: Record<string, unknown>,
  originalItem: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  const raw =
    item[key] !== undefined ? item[key] : originalItem?.[key]
  return raw === true
}

function getSourceText(
  entityType: MessageServicesEntityType,
  item: Record<string, unknown>
): string {
  switch (entityType) {
    case 'post':
    case 'comment':
    case 'content':
      return normText(item.content)
    case 'topic':
      return normText(item.name)
    case 'poll':
      return normText(item.title)
    case 'pollOption':
      return normText(item.text)
    case 'forbiddenKeyword':
      return normText(item.word)
    default:
      return ''
  }
}

/**
 * create：有原文就觸發翻譯。
 * update：僅在「原文欄位」有變更時觸發（翻譯欄位寫回不觸發，避免迴圈）。
 * Post：另見標題／正文邏輯。
 */
function shouldSyncTranslations(
  entityType: MessageServicesEntityType,
  operation: 'create' | 'update' | 'delete',
  item: Record<string, unknown>,
  originalItem: Record<string, unknown> | null | undefined
): boolean {
  if (entityType === 'post' || entityType === 'content') {
    const title = readMergedText(item, originalItem, 'title')
    const content = readMergedText(item, originalItem, 'content')
    if (!title && !content) return false
    if (operation === 'create') return true
    if (operation !== 'update' || !originalItem) return false
    const prevTitle = normText(originalItem.title)
    const prevContent = normText(originalItem.content)
    const nextTitle = readMergedText(item, originalItem, 'title')
    const nextContent = readMergedText(item, originalItem, 'content')
    return prevTitle !== nextTitle || prevContent !== nextContent
  }

  const src = getSourceText(entityType, item)
  if (!src) return false
  if (operation === 'create') return true
  if (operation !== 'update' || !originalItem) return false
  return getSourceText(entityType, originalItem) !== src
}

/**
 * Post / Comment / Topic / Poll / PollOption / Content / ForbiddenKeyword 建立或原文變更後，
 * 呼叫 message-services POST /hooks/sync-translations。
 */
export function createMessageServicesTranslationHook(
  entityType: MessageServicesEntityType
): AfterOperationHookFn {
  return async ({ item, originalItem, operation }) => {
    if (operation === 'delete') return

    const baseUrl = envVar.messageServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) {
      warnMissingMessageServicesUrlOnce()
      return
    }

    const id = item && String((item as { id?: unknown }).id ?? '')
    if (!id) return

    const rec = item as Record<string, unknown>
    const orig = originalItem as Record<string, unknown> | null | undefined

    if (
      entityType === 'post' &&
      readMergedBool(rec, orig, 'pauseAutoTranslation')
    ) {
      return
    }

    if (!shouldSyncTranslations(entityType, operation, rec, orig)) {
      if (
        operation === 'create' &&
        !getSourceText(entityType, rec)
      ) {
        console.info(
          JSON.stringify({
            severity: 'INFO',
            message:
              '翻譯 hook 略過：建立時原文欄位為空（未填寫可翻譯原文）。',
            entityType,
            id,
            timestamp: new Date().toISOString(),
          })
        )
      }
      return
    }

    const sourceText =
      entityType === 'post' || entityType === 'content'
        ? readMergedText(rec, orig, 'content')
        : getSourceText(entityType, rec)
    const sourceTitle =
      entityType === 'post' || entityType === 'content'
        ? readMergedText(rec, orig, 'title')
        : ''

    try {
      const syncRes = await fetch(`${baseUrl}/hooks/sync-translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: entityType,
          id,
          source_text: sourceText,
          ...(entityType === 'post' || entityType === 'content'
            ? { source_title: sourceTitle }
            : {}),
        }),
      })
      if (!syncRes.ok) {
        const bodyText = await syncRes.text()
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: 'message-services sync-translations failed',
            status: syncRes.status,
            entityType,
            id,
            detail: bodyText.slice(0, 2000),
            timestamp: new Date().toISOString(),
          })
        )
      } else {
        console.info(
          JSON.stringify({
            severity: 'INFO',
            message: 'message-services sync-translations 已請求',
            status: syncRes.status,
            entityType,
            id,
            timestamp: new Date().toISOString(),
          })
        )

        // content 在翻譯寫回後，立即觸發 JSON 匯出到 GCS（單筆 id）
        if (entityType === 'content') {
          const exportRes = await fetch(`${baseUrl}/export/contents-to-gcs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id,
            }),
          })

          if (!exportRes.ok) {
            const exportBodyText = await exportRes.text()
            console.error(
              JSON.stringify({
                severity: 'ERROR',
                message: 'message-services export/contents-to-gcs failed',
                status: exportRes.status,
                entityType,
                id,
                detail: exportBodyText.slice(0, 2000),
                timestamp: new Date().toISOString(),
              })
            )
          } else {
            console.info(
              JSON.stringify({
                severity: 'INFO',
                message: 'message-services export/contents-to-gcs 已請求',
                status: exportRes.status,
                entityType,
                id,
                bucket: envVar.gcs.bucket,
                timestamp: new Date().toISOString(),
              })
            )
          }
        }
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: 'message-services sync-translations request failed',
          entityType,
          id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
