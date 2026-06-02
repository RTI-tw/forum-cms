/**
 * 連結網址安全性檢查：僅允許 http/https 絕對網址或站內相對路徑（以 `/` 開頭，
 * 但排除 `//host` 這種 protocol-relative 形式）。阻擋 `javascript:`、`data:`、
 * `vbscript:` 等危險 scheme，作為前台將其渲染為 <a href> 時的縱深防禦（stored XSS）。
 * 空字串視為未填、允許。
 */
export function isSafeLinkUrl(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  // 站內相對路徑：以單一 `/` 開頭。排除 `//host`（protocol-relative）與含反斜線的
  // `/\host`（部分瀏覽器會正規化成 `//host`），避免變成 open redirect。
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('\\')
  ) {
    return true
  }
  try {
    const { protocol } = new URL(trimmed)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
