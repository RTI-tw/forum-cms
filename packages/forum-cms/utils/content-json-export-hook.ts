import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

let warnedMissingMessageServicesUrl = false

function warnMissingMessageServicesUrlOnce() {
  if (warnedMissingMessageServicesUrl) return
  warnedMissingMessageServicesUrl = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message:
        'MESSAGE_SERVICES_URL 未設定，Content JSON export hook 不會呼叫 message-services。',
      timestamp: new Date().toISOString(),
    })
  )
}

export function createContentJsonExportHook(): AfterOperationHookFn {
  return async ({ operation }) => {
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
      return
    }

    const baseUrl = envVar.messageServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) {
      warnMissingMessageServicesUrlOnce()
      return
    }

    try {
      const exportRes = await fetch(`${baseUrl}/export/contents-to-gcs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!exportRes.ok) {
        const detail = await exportRes.text()
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: 'message-services export/contents-to-gcs failed',
            status: exportRes.status,
            operation,
            detail: detail.slice(0, 2000),
            timestamp: new Date().toISOString(),
          })
        )
        return
      }

      console.info(
        JSON.stringify({
          severity: 'INFO',
          message: 'message-services export/contents-to-gcs 已請求',
          status: exportRes.status,
          operation,
          bucket: envVar.gcs.bucket,
          timestamp: new Date().toISOString(),
        })
      )
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: 'message-services export/contents-to-gcs request failed',
          operation,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
