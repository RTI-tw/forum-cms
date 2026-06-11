import crypto from 'crypto'
import envVar from '../environment-variables'

const TOKEN_PREFIX = 'evtqr_'
const TOKEN_BYTES = 32

function getEventQrTokenPepper() {
  return `${envVar.memberSession.secret}:event-check-in-qr`
}

export function generateEventQrToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(TOKEN_BYTES).toString('base64url')}`
}

export function normalizeEventQrTokenInput(value?: string | null) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    const token = url.searchParams.get('token')?.trim()
    return token && token.startsWith(TOKEN_PREFIX) ? token : null
  } catch (_error) {
    return trimmed.startsWith(TOKEN_PREFIX) ? trimmed : null
  }
}

export function hashEventQrToken(token: string) {
  const normalized = normalizeEventQrTokenInput(token)
  if (!normalized) {
    throw new Error('Invalid event QR token')
  }

  return crypto
    .createHash('sha256')
    .update(normalized)
    .update(':')
    .update(getEventQrTokenPepper())
    .digest('hex')
}
