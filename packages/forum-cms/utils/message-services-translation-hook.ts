import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

/** 與 message-services `KeystoneHookSyncTranslationRequest.type` 一致 */
export type MessageServicesEntityType =
  | 'post'
  | 'comment'
  | 'topic'
  | 'poll'
  | 'pollOption'
  | 'content'

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
  if (entityType === 'post') {
    const content = normText(item.content)
    if (!content) return false
    if (operation === 'create') return true
    if (operation !== 'update' || !originalItem) return false
    const prevTitle = normText(originalItem.title)
    const prevContent = normText(originalItem.content)
    const nextTitle = normText(item.title)
    const nextContent = normText(item.content)
    const articleBodyTouched =
      prevTitle !== nextTitle || prevContent !== nextContent
    if (!articleBodyTouched) return false
    return prevContent !== nextContent
  }

  const src = getSourceText(entityType, item)
  if (!src) return false
  if (operation === 'create') return true
  if (operation !== 'update' || !originalItem) return false
  return getSourceText(entityType, originalItem) !== src
}

/**
 * Post / Comment / Topic / Poll / PollOption / Content 建立或原文變更後，
 * 呼叫 message-services POST /hooks/sync-translations。
 */
export function createMessageServicesTranslationHook(
  entityType: MessageServicesEntityType
): NonNullable<ListHooks<any>['afterOperation']> {
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

    const sourceText = getSourceText(entityType, rec)

    try {
      const res = await fetch(`${baseUrl}/hooks/sync-translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: entityType,
          id,
          source_text: sourceText,
        }),
      })
      if (!res.ok) {
        const bodyText = await res.text()
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: 'message-services sync-translations failed',
            status: res.status,
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
            status: res.status,
            entityType,
            id,
            timestamp: new Date().toISOString(),
          })
        )
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
