import fs from 'fs/promises'
import path from 'path'
import { Storage } from '@google-cloud/storage'
import type { ListHooks } from '@keystone-6/core/types'
import envVar from '../environment-variables'

type AfterOperationHookFn = Extract<
  NonNullable<ListHooks<any>['afterOperation']>,
  (...args: any[]) => any
>

type ForbiddenKeywordRecord = {
  id: number | string
  word: string
  language: 'zh' | 'en' | 'vi' | 'id' | 'th'
  word_zh?: string | null
  word_en?: string | null
  word_vi?: string | null
  word_id?: string | null
  word_th?: string | null
  exemptions?: string | null
  updatedAt?: string | Date | null
}

const storage = new Storage()
const KEYWORDS_FILENAME = 'keywords.json'

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function parseExemptions(raw: string | null | undefined) {
  return normalizeText(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function buildKeywordsPayload(items: ForbiddenKeywordRecord[]) {
  const keywords = items.map((item) => ({
    id: String(item.id),
    word: normalizeText(item.word),
    language: item.language,
    translations: {
      zh: normalizeText(item.word_zh),
      en: normalizeText(item.word_en),
      vi: normalizeText(item.word_vi),
      id: normalizeText(item.word_id),
      th: normalizeText(item.word_th),
    },
    exemptions: parseExemptions(item.exemptions),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
  }))

  return {
    generatedAt: new Date().toISOString(),
    total: keywords.length,
    keywords,
  }
}

function getLocalKeywordsJsonPath() {
  return path.resolve(process.cwd(), envVar.files.storagePath, KEYWORDS_FILENAME)
}

function getGcsObjectPath() {
  const basePath = envVar.files.baseUrl.replace(/^\/+|\/+$/g, '')
  return basePath ? `${basePath}/${KEYWORDS_FILENAME}` : KEYWORDS_FILENAME
}

async function writeKeywordsJsonToLocal(jsonText: string) {
  const localPath = getLocalKeywordsJsonPath()
  await fs.mkdir(path.dirname(localPath), { recursive: true })
  await fs.writeFile(localPath, jsonText, 'utf8')
  return localPath
}

async function uploadKeywordsJsonToGcs(jsonText: string) {
  const bucketName = envVar.gcs.bucket?.trim()
  if (!bucketName) {
    throw new Error('GCS bucket is not configured')
  }

  const file = storage.bucket(bucketName).file(getGcsObjectPath())
  await file.save(jsonText, {
    resumable: false,
    contentType: 'application/json; charset=utf-8',
    public: false,
  })
}

export async function syncForbiddenKeywordsJson(context: {
  sudo: () => {
    db: {
      ForbiddenKeyword: {
        findMany(args: Record<string, unknown>): Promise<ForbiddenKeywordRecord[]>
      }
    }
  }
}) {
  const items = await context.sudo().db.ForbiddenKeyword.findMany({
    where: { isEnabled: { equals: true } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    query:
      'id word language word_zh word_en word_vi word_id word_th exemptions updatedAt',
  })

  const payload = buildKeywordsPayload(items)
  const jsonText = `${JSON.stringify(payload, null, 2)}\n`
  const localPath = await writeKeywordsJsonToLocal(jsonText)
  await uploadKeywordsJsonToGcs(jsonText)

  console.info(
    JSON.stringify({
      severity: 'INFO',
      message: 'keywords.json 已同步到本機與 GCS',
      keywordsCount: payload.total,
      localPath,
      bucket: envVar.gcs.bucket,
      objectPath: getGcsObjectPath(),
      timestamp: new Date().toISOString(),
    })
  )
}

export function createForbiddenKeywordsJsonSyncHook(): AfterOperationHookFn {
  return async ({ operation, context }) => {
    if (!context) return
    if (operation !== 'create' && operation !== 'update' && operation !== 'delete') {
      return
    }

    try {
      await syncForbiddenKeywordsJson(context as any)
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: 'ERROR',
          message: '同步 keywords.json 失敗',
          operation,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
