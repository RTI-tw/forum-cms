import type { KeystoneContext } from '@keystone-6/core/types'
import { timingSafeEqual } from 'crypto'

function getBearerToken(context: KeystoneContext): string | null {
  const authHeader = context.req?.headers?.authorization
  if (typeof authHeader !== 'string') return null
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

export function isCronServiceRequest(context: KeystoneContext): boolean {
  const expected = process.env.CRON_SERVICES_GQL_WRITE_TOKEN?.trim()
  if (!expected) return false
  const token = getBearerToken(context)
  if (!token) return false

  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  if (tokenBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(tokenBuffer, expectedBuffer)
}
