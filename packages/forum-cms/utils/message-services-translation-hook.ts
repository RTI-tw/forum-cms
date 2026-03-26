import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

type ArticleType = 'post' | 'comment'

function normText(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * create：有「原文內容」就觸發翻譯。
 * update：僅在「文章本身」有編輯時才可能觸發——
 *   - Post：標題或正文其一相對於更新前有變，且翻譯 API 只依正文，故僅在 **正文 content** 有變時才呼叫（僅改標題不呼叫）。
 *   - Comment：僅比對 **正文 content**。
 * 僅改狀態、分類、主圖、翻譯欄位等（原文 title/content 未變）→ 不觸發。
 */
function shouldSyncTranslations(
  articleType: ArticleType,
  operation: 'create' | 'update' | 'delete',
  item: { title?: unknown; content?: unknown },
  originalItem: { title?: unknown; content?: unknown } | null | undefined
): boolean {
  const content = normText(item.content)
  if (!content) return false

  if (operation === 'create') return true

  if (operation !== 'update' || !originalItem) return false

  const prevTitle = normText(originalItem.title)
  const prevContent = normText(originalItem.content)
  const nextTitle = normText(item.title)
  const nextContent = normText(item.content)

  if (articleType === 'post') {
    const articleBodyTouched =
      prevTitle !== nextTitle || prevContent !== nextContent
    if (!articleBodyTouched) return false
    // 翻譯以 content 為準；正文未改則不呼叫（例如只改標題、或僅動到其他欄位）
    return prevContent !== nextContent
  }

  return prevContent !== nextContent
}

/**
 * Post / Comment 在建立或「文章本身」變更後，呼叫 message-services 的
 * POST /hooks/sync-translations（與 app/hooks_translate.py 一致）。
 * 服務端寫回翻譯欄位時 content 不變 → 不觸發，避免迴圈。
 */
export function createMessageServicesTranslationHook(
  articleType: ArticleType
): NonNullable<ListHooks<any>['afterOperation']> {
  return async ({ item, originalItem, operation }) => {
    if (operation === 'delete') return

    const baseUrl = envVar.messageServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) return

    const id = item && String((item as { id?: unknown }).id ?? '')
    if (!id) return

    if (
      !shouldSyncTranslations(
        articleType,
        operation,
        item as { title?: unknown; content?: unknown },
        originalItem as { title?: unknown; content?: unknown } | null | undefined
      )
    ) {
      return
    }

    const content = normText((item as { content?: unknown }).content)

    try {
      const res = await fetch(`${baseUrl}/hooks/sync-translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: articleType,
          id,
          source_text: content,
        }),
      })
      if (!res.ok) {
        const bodyText = await res.text()
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: 'message-services sync-translations failed',
            status: res.status,
            articleType,
            id,
            detail: bodyText.slice(0, 2000),
            timestamp: new Date().toISOString(),
          })
        )
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: 'message-services sync-translations request failed',
          articleType,
          id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
