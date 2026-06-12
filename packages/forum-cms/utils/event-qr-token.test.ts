import assert from 'assert'
import {
  generateEventQrToken,
  hashEventQrToken,
  normalizeEventQrTokenInput,
} from './event-qr-token'

declare const test: (name: string, fn: () => void) => void

test('generates opaque non-expiring QR tokens', () => {
  const token = generateEventQrToken()

  assert.match(token, /^evtqr_[A-Za-z0-9_-]{43}$/)
  assert.equal(token.includes('expires'), false)
})

test('hashes QR tokens without exposing plaintext token', () => {
  const token = generateEventQrToken()
  const hash = hashEventQrToken(token)

  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.notEqual(hash, token)
  assert.equal(hashEventQrToken(token), hash)
})

test('normalizes token values from raw strings and URLs', () => {
  const token = generateEventQrToken()

  assert.equal(normalizeEventQrTokenInput(` ${token} `), token)
  assert.equal(
    normalizeEventQrTokenInput(`https://cms.example.test/event-checkin?token=${token}`),
    token
  )
})
