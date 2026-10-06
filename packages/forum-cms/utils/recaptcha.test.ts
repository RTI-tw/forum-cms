import assert from 'node:assert/strict'
import envVar from '../environment-variables'
import { verifyRecaptchaToken } from './recaptcha'

async function main() {
  envVar.recaptcha.enabled = true
  envVar.recaptcha.secretKey = 'test-secret'
  let calls = 0
  let result: any = { success: true, hostname: 'cms.example.test' }
  const originalFetch = global.fetch
  global.fetch = (async (_url: any, options: any) => {
    calls++
    const body = new URLSearchParams(options.body)
    assert.equal(body.get('secret'), 'test-secret')
    assert.equal(body.get('response'), 'test-token')
    return { ok: true, json: async () => result } as any
  }) as any
  try {
    assert.equal((await verifyRecaptchaToken(null, 'login')).success, false)
    assert.equal(calls, 0)
    // Checkbox responses have neither a score nor an action.
    assert.equal((await verifyRecaptchaToken('test-token', 'login')).success, true)
    assert.equal((await verifyRecaptchaToken('test-token', 'forgot_password')).success, true)
    result = { success: false, 'error-codes': ['timeout-or-duplicate'] }
    const expired = await verifyRecaptchaToken('test-token', 'login')
    assert.equal(expired.success, false)
    assert.deepEqual(expired.errorCodes, ['timeout-or-duplicate'])
    global.fetch = (async () => { throw new Error('network unavailable') }) as any
    assert.equal((await verifyRecaptchaToken('test-token')).success, false)
    envVar.recaptcha.secretKey = ''
    assert.equal((await verifyRecaptchaToken('test-token')).success, false)
    console.log('v2 checkbox verification, missing token/config, expired/replayed token and network failure passed')
  } finally { global.fetch = originalFetch }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
