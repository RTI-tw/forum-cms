import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function encodeBase32(bytes: Buffer): string {
  let bits = 0, value = 0, output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}
function decodeBase32(secret: string): Buffer {
  let bits = 0, value = 0
  const bytes: number[] = []
  for (const char of secret) {
    const digit = ALPHABET.indexOf(char)
    if (digit < 0) throw new Error('Invalid TOTP secret')
    value = (value << 5) | digit; bits += 5
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(bytes)
}
export function generateTotpSecret() { return encodeBase32(randomBytes(20)) }
export function totpAtStep(secret: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hash = createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = hash[hash.length - 1] & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0')
}
export function verifyTotp(secret: string, code: string, lastStep = -1, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null
  const step = Math.floor(now / 30000)
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate <= lastStep || candidate < 0) continue
    if (timingSafeEqual(Buffer.from(totpAtStep(secret, candidate)), Buffer.from(code))) return candidate
  }
  return null
}
export function mfaEncryptionKey(): Buffer {
  const value = process.env.CMS_MFA_ENCRYPTION_KEY || ''
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('CMS_MFA_ENCRYPTION_KEY must be a 32-byte hex key')
  return Buffer.from(value, 'hex')
}
export function encryptTotpSecret(secret: string, userId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', mfaEncryptionKey(), iv)
  cipher.setAAD(Buffer.from(userId))
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(v => v.toString('base64url')).join('.')
}
export function decryptTotpSecret(value: string, userId: string): string {
  const [iv, tag, ciphertext] = value.split('.').map(v => Buffer.from(v, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', mfaEncryptionKey(), iv)
  decipher.setAAD(Buffer.from(userId)); decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
export function passwordFingerprint(passwordHash: string) { return createHash('sha256').update(passwordHash).digest('hex') }
export function recoveryCodeHash(code: string) { return createHash('sha256').update(code.toUpperCase().replace(/[\s-]/g, '')).digest('hex') }
export function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(10).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'))
}
