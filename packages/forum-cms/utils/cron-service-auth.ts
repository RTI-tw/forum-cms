import type { KeystoneContext } from '@keystone-6/core/types'
import { timingSafeEqual } from 'crypto'

function getBearerToken(context: KeystoneContext): string | null {
  const authHeader = context.req?.headers?.authorization
  if (typeof authHeader !== 'string') return null
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

function getCronServiceToken(context: KeystoneContext): string | null {
  const header = context.req?.headers?.['x-cron-service-token']
  const token = Array.isArray(header) ? header[0] : header
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function isCronServiceRequest(context: KeystoneContext): boolean {
  const expected = process.env.CRON_SERVICES_GQL_WRITE_TOKEN?.trim()
  if (!expected) return false
  // Cloud Run may reserve Authorization for platform authentication, so
  // deployed cron-services uses a dedicated header. Bearer remains supported
  // for local development and backwards compatibility.
  const token = getCronServiceToken(context) ?? getBearerToken(context)
  if (!token) return false

  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  if (tokenBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(tokenBuffer, expectedBuffer)
}
