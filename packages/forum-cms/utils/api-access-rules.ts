/**
 * ACCESS_CONTROL_STRATEGY=api 時使用（見 utils/access-control.ts 包裝層）。
 * 環境變數 ACCESS_CONTROL_API_RULES_JSON：JSON 物件，key 為 listKey（與 Keystone list 名稱一致，如 Post、Photo），
 * value 為 "none" | "read" | "read_write"。
 *
 * - none：不可 query / 不可寫入
 * - read：僅 GraphQL query（含 list item）允許；create/update/delete 皆拒絕
 * - read_write：query 與 mutations 皆允許（仍不檢查 CMS role）
 *
 * 未出現在 JSON 的 list：使用預設規則（見 getDefaultApiLevel）。
 * 可選 key "*": 作為未列名 list 的 fallback。
 */

export type ApiAccessLevel = 'none' | 'read' | 'read_write'

const VALID: ApiAccessLevel[] = ['none', 'read', 'read_write']

function parseRulesJson(): Record<string, ApiAccessLevel> {
  const raw = process.env.ACCESS_CONTROL_API_RULES_JSON?.trim()
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, ApiAccessLevel> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && VALID.includes(v as ApiAccessLevel)) {
        out[k] = v as ApiAccessLevel
      }
    }
    return out
  } catch {
    return {}
  }
}

let cachedRules: Record<string, ApiAccessLevel> | null = null

export function getApiAccessRules(): Record<string, ApiAccessLevel> {
  if (!cachedRules) {
    cachedRules = parseRulesJson()
  }
  return cachedRules
}

/** 未在規則中指定的 list 預設為 none（最安全） */
export function getDefaultApiLevel(): ApiAccessLevel {
  const d = process.env.ACCESS_CONTROL_API_DEFAULT?.trim()
  if (d === 'read' || d === 'read_write' || d === 'none') {
    return d
  }
  return 'none'
}

export function getApiLevelForList(listKey: string): ApiAccessLevel {
  const rules = getApiAccessRules()
  if (rules[listKey]) {
    return rules[listKey]
  }
  if (rules['*']) {
    return rules['*']
  }
  return getDefaultApiLevel()
}

export function isApiAccessAllowed(
  listKey: string,
  operation: 'query' | 'create' | 'update' | 'delete' | undefined
): boolean {
  const level = getApiLevelForList(listKey)
  if (level === 'none') {
    return false
  }
  if (
    operation !== 'query' &&
    operation !== 'create' &&
    operation !== 'update' &&
    operation !== 'delete'
  ) {
    return false
  }
  if (level === 'read') {
    return operation === 'query'
  }
  // read_write
  return true
}
