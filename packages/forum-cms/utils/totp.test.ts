import assert from 'assert'
import { encodeBase32, totpAtStep, verifyTotp, encryptTotpSecret, decryptTotpSecret, generateRecoveryCodes, recoveryCodeHash } from './totp'
const secret = encodeBase32(Buffer.from('12345678901234567890'))
// RFC 6238 Appendix B, SHA-1 test vectors.
for (const [seconds, expected] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']] as const) {
  assert.equal(totpAtStep(secret, Math.floor(seconds / 30), 8), expected)
}
const now = 1800000000000, step = Math.floor(now / 30000), code = totpAtStep(secret, step)
assert.equal(verifyTotp(secret, code, -1, now), step)
assert.equal(verifyTotp(secret, code, step, now), null)
assert.equal(verifyTotp(secret, totpAtStep(secret, step - 1), -1, now), step - 1)
assert.equal(verifyTotp(secret, totpAtStep(secret, step - 2), -1, now), null)
assert.equal(verifyTotp(secret, '12345', -1, now), null)
process.env.CMS_MFA_ENCRYPTION_KEY = '12'.repeat(32)
const encrypted = encryptTotpSecret(secret, '1')
assert.equal(decryptTotpSecret(encrypted, '1'), secret)
assert.throws(() => decryptTotpSecret(encrypted, '2'))
assert.throws(() => decryptTotpSecret(encrypted.slice(0, -2) + 'AA', '1'))
const codes = generateRecoveryCodes()
assert.equal(new Set(codes).size, 10)
assert.equal(recoveryCodeHash(codes[0]), recoveryCodeHash(codes[0].toLowerCase().replace(/-/g, '')))
console.log('TOTP RFC vectors, replay/window, encryption and recovery checks passed')
