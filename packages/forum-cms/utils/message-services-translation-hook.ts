import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

type ArticleType = 'post' | 'comment'

/**
 * Post / Comment 在建立或「原文內容」變更後，呼叫 message-services 的
 * POST /hooks/sync-translations（與 app/hooks_translate.py 一致）。
 * 若僅更新翻譯欄位（由服務端寫回），content 不變則不觸發，避免迴圈。
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

    const content = String((item as { content?: unknown }).content ?? '').trim()
    if (!content) return

    if (operation === 'update' && originalItem) {
      const prev = String(
        (originalItem as { content?: unknown }).content ?? ''
      ).trim()
      if (prev === content) return
    }

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
