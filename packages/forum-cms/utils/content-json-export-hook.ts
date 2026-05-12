import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'
import { fetchWithTimeout } from './fetch-with-timeout'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

let warnedMissingCronServicesUrl = false

function warnMissingCronServicesUrlOnce() {
  if (warnedMissingCronServicesUrl) return
  warnedMissingCronServicesUrl = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message:
        'CRON_SERVICES_URL 未設定，Content JSON export hook 不會呼叫 cron-services。',
      timestamp: new Date().toISOString(),
    })
  )
}

export function createContentJsonExportHook(): AfterOperationHookFn {
  return async ({ operation }) => {
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
      return
    }

    const baseUrl = envVar.cronServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) {
      warnMissingCronServicesUrlOnce()
      return
    }

    try {
      const exportRes = await fetchWithTimeout(
        `${baseUrl}/export/contents-to-gcs`,
        {
          method: 'GET',
        },
        envVar.messageServices.hookTimeoutMs,
        `cron-services export/contents-to-gcs timed out after ${envVar.messageServices.hookTimeoutMs}ms`
      )

      if (!exportRes.ok) {
        const detail = await exportRes.text()
        console.error(
          JSON.stringify({
            severity: 'ERROR',
            message: 'cron-services export/contents-to-gcs failed',
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
          message: 'cron-services export/contents-to-gcs 已請求',
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
          message: 'cron-services export/contents-to-gcs request failed',
          operation,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
