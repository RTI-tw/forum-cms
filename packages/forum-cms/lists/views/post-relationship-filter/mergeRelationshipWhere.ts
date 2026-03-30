/**
 * 與 Keystone RelationshipSelect 的 useSearchFilter 搭配：
 * 無搜尋字時為 `{ OR: [] }`，此時僅套用 baseWhere。
 */
export function mergeRelationshipWhere(
  baseWhere: Record<string, unknown>,
  searchWhere: Record<string, unknown>
): Record<string, unknown> {
  const or = (searchWhere as { OR?: unknown[] }).OR
  if (Array.isArray(or) && or.length === 0) {
    return baseWhere
  }
  return { AND: [baseWhere, searchWhere] }
}
