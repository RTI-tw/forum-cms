import type { ListHooks } from '@keystone-6/core/types'
import { createCronJsonExportHook } from './cron-json-export-hook'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

export function createContentJsonExportHook(): AfterOperationHookFn {
  return createCronJsonExportHook({
    label: 'content json export',
    endpoints: ['/export/contents-to-gcs'],
  })
}
