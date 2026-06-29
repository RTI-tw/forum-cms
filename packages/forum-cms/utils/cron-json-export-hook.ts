import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'
import { fetchWithTimeout } from './fetch-with-timeout'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

type HookArgs = Parameters<AfterOperationHookFn>[0] & {
  resolvedData?: Record<string, unknown>
}

type CronJsonExportHookConfig = {
  label: string
  endpoints: string[]
  shouldTrigger?: (args: HookArgs) => boolean
}

type TriggerArgs = {
  operation: string
  resolvedData?: Record<string, unknown>
}

export const HOME_EDITOR_CHOICES_EXPORT_ENDPOINT =
  '/export/home-editor-choices-to-gcs'
export const CURATED_POSTS_LATEST_POLLS_EXPORT_ENDPOINT =
  '/export/curated-posts-latest-polls-to-gcs'
export const ADS_EXPORT_ENDPOINT = '/export/ads-to-gcs'

export const EDITOR_CHOICE_JSON_EXPORT_FIELDS = [
  'post',
  'sortOrder',
  'state',
] as const

export const POST_JSON_EXPORT_FIELDS = [
  'status',
  'published_date',
  'isEditorChoice',
  'isLifeGuide',
  'isRtiChoice',
  'isBoost',
  'title',
  'title_zh',
  'title_en',
  'title_vi',
  'title_id',
  'title_th',
  'content',
  'heroImages',
  'author',
  'poll',
  'commentsCount',
  'reactionsCount',
] as const

export const AD_JSON_EXPORT_FIELDS = [
  'title',
  'format',
  'status',
  'startAt',
  'endAt',
  'image',
  'mobileImage',
  'slides',
  'videoUrl',
  'videoFile',
  'adCode',
  'linkUrl',
] as const

export const AD_SLIDE_JSON_EXPORT_FIELDS = [
  'ad',
  'image',
  'mobileImage',
  'linkUrl',
  'sortOrder',
] as const

let warnedMissingCronServicesUrl = false

export function hasAnyResolvedField(
  resolvedData: Record<string, unknown> | undefined,
  fields: readonly string[]
) {
  if (!resolvedData) return false
  return fields.some((field) =>
    Object.prototype.hasOwnProperty.call(resolvedData, field)
  )
}

function shouldTriggerByFields(
  { operation, resolvedData }: TriggerArgs,
  fields: readonly string[]
) {
  return operation !== 'update' || hasAnyResolvedField(resolvedData, fields)
}

export function shouldTriggerEditorChoiceJsonExport(args: TriggerArgs) {
  return shouldTriggerByFields(args, EDITOR_CHOICE_JSON_EXPORT_FIELDS)
}

export function shouldTriggerPostJsonExport(args: TriggerArgs) {
  return shouldTriggerByFields(args, POST_JSON_EXPORT_FIELDS)
}

export function shouldTriggerAdJsonExport(args: TriggerArgs) {
  return shouldTriggerByFields(args, AD_JSON_EXPORT_FIELDS)
}

export function shouldTriggerAdSlideJsonExport(args: TriggerArgs) {
  return shouldTriggerByFields(args, AD_SLIDE_JSON_EXPORT_FIELDS)
}

function warnMissingCronServicesUrlOnce() {
  if (warnedMissingCronServicesUrl) return
  warnedMissingCronServicesUrl = true
  console.warn(
    JSON.stringify({
      severity: 'WARN',
      message:
        'CRON_SERVICES_URL 未設定，JSON export hook 不會呼叫 cron-services。',
      timestamp: new Date().toISOString(),
    })
  )
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
}

export function createCronJsonExportHook({
  label,
  endpoints,
  shouldTrigger,
}: CronJsonExportHookConfig): AfterOperationHookFn {
  return async (args) => {
    const operation = args.operation
    if (
      operation !== 'create' &&
      operation !== 'update' &&
      operation !== 'delete'
    ) {
      return
    }
    if (shouldTrigger && !shouldTrigger(args as HookArgs)) {
      return
    }

    const baseUrl = envVar.cronServicesUrl?.replace(/\/$/, '')
    if (!baseUrl) {
      warnMissingCronServicesUrlOnce()
      return
    }

    for (const endpoint of endpoints) {
      const normalizedEndpoint = normalizeEndpoint(endpoint)
      try {
        const exportRes = await fetchWithTimeout(
          `${baseUrl}${normalizedEndpoint}`,
          { method: 'GET' },
          envVar.messageServices.hookTimeoutMs,
          `cron-services ${normalizedEndpoint.replace(
            /^\//,
            ''
          )} timed out after ${envVar.messageServices.hookTimeoutMs}ms`
        )

        if (!exportRes.ok) {
          const detail = await exportRes.text()
          console.error(
            JSON.stringify({
              severity: 'ERROR',
              message: `cron-services ${normalizedEndpoint} failed`,
              label,
              endpoint: normalizedEndpoint,
              status: exportRes.status,
              operation,
              detail: detail.slice(0, 2000),
              timestamp: new Date().toISOString(),
            })
          )
          continue
        }

        console.info(
          JSON.stringify({
            severity: 'INFO',
            message: `cron-services ${normalizedEndpoint} 已請求`,
            label,
            endpoint: normalizedEndpoint,
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
            message: `cron-services ${normalizedEndpoint} request failed`,
            label,
            endpoint: normalizedEndpoint,
            operation,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          })
        )
      }
    }
  }
}
