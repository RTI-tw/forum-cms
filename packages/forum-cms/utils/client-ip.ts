import type { IncomingHttpHeaders } from 'http'

/**
 * 從 Keystone `context.req` 取得客戶端 IP（與 login-logging 邏輯一致：優先 x-forwarded-for 第一跳）。
 */
export function getClientIpFromKeystoneContext(context: {
    req?: {
        headers?: IncomingHttpHeaders
        socket?: { remoteAddress?: string }
    }
}): string {
    const req = context.req
    if (!req) return ''
    const xff = req.headers?.['x-forwarded-for']
    if (typeof xff === 'string' && xff.trim()) {
        return xff.split(',')[0].trim()
    }
    if (Array.isArray(xff) && xff[0]) {
        return String(xff[0]).split(',')[0].trim()
    }
    const ra = req.socket?.remoteAddress
    return typeof ra === 'string' ? ra : ''
}
