import assert from 'assert'
import express from 'express'
import { statelessSessions } from '@keystone-6/core/session'
import { createCmsMfa, isPendingMfaSession, isVerifiedMfaSession } from './cms-mfa'
import { totpAtStep } from './totp'
async function main() {
  process.env.CMS_MFA_ENCRYPTION_KEY = '34'.repeat(32)
  const user: any = { id: 1, email: 'editor@example.test', password: 'hashed-password', passwordUpdatedAt: new Date(), mfaState: null, mfaRevision: 0 }
  const prisma = { user: {
    async findUnique() { return structuredClone(user) },
    async updateMany({ where, data }: any) {
      if (where.mfaRevision !== user.mfaRevision || where.password !== user.password) return { count: 0 }
      user.mfaRevision++; user.mfaState = structuredClone(data.mfaState); return { count: 1 }
    },
  } }
  const context = { sudo: () => ({ prisma }), async withRequest(req: any, res: any) { return { ...context, req, res } } }
  const raw = statelessSessions({ secret: 'test-session-secret-longer-than-32-characters', secure: false })
  const mfa = createCmsMfa(raw), app = express()
  app.use(express.json()); mfa.mount(app, context)
  app.post('/password', async (req, res) => {
    const token = await mfa.strategy.start({ context: await context.withRequest(req, res), data: { listKey: 'User', itemId: '1', mfaVerified: true } })
    res.json({ token })
  })
  app.get('/protected', async (req, res) => res.sendStatus(await mfa.strategy.get({ context: await context.withRequest(req, res) }) ? 200 : 401))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  let cookie = ''
  const request = async (path: string, options: any = {}) => {
    const response = await fetch(base + path, { ...options, headers: { Cookie: cookie, ...options.headers } })
    const nextCookie = response.headers.get('set-cookie'); if (nextCookie) cookie = nextCookie.split(';')[0]
    return response
  }
  const verify = (code: string, useRecovery = false) => request('/api/cms-mfa', { method: 'POST', headers: { Origin: base, 'X-CMS-MFA': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ code, useRecovery }) })
  try {
    assert.equal((await request('/protected')).status, 401)
    await request('/password', { method: 'POST' }); const pendingCookie = cookie
    assert.equal((await request('/', { redirect: 'manual' })).headers.get('location'), '/mfa')
    assert.equal((await request('/protected')).status, 401)
    const setup = await (await request('/api/cms-mfa')).json()
    assert.equal(setup.enrollment, true)
    const code = totpAtStep(setup.secret, Math.floor(Date.now() / 30000))
    assert.equal((await request('/api/cms-mfa', { method: 'POST', headers: { Origin: 'https://evil.example', 'X-CMS-MFA': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })).status, 403)
    const enrolled = await (await verify(code)).json()
    assert.equal(enrolled.recoveryCodes.length, 10)
    assert.equal((await request('/protected')).status, 200)
    assert.ok(!JSON.stringify(user.mfaState).includes(setup.secret))
    assert.ok(!JSON.stringify(user.mfaState).includes(enrolled.recoveryCodes[0]))
    const verifiedCookie = cookie; cookie = pendingCookie
    assert.equal((await verify(code)).status, 400)
    await request('/password', { method: 'POST' })
    const status = await (await request('/api/cms-mfa')).json()
    assert.equal(status.enrollment, false); assert.equal(status.secret, undefined)
    const recoveryCookie = cookie
    const concurrent = await Promise.all([verify(enrolled.recoveryCodes[0], true), verify(enrolled.recoveryCodes[0], true)])
    assert.equal(concurrent.filter(response => response.status === 200).length, 1)
    cookie = recoveryCookie
    assert.equal((await verify(enrolled.recoveryCodes[0], true)).status, 400)
    user.mfaState.failures = 0; user.mfaState.lockedUntil = 0
    const guesses = await Promise.all(Array.from({ length: 12 }, () => verify('bad')))
    assert.equal(user.mfaState.failures, guesses.filter(response => response.status === 400).length)
    user.mfaState.failures = 0; user.mfaState.lockedUntil = 0
    for (let i = 0; i < 5; i++) assert.equal((await verify('bad')).status, 400)
    assert.equal((await verify(enrolled.recoveryCodes[1], true)).status, 429)
    assert.equal((await request('/api/cms-mfa')).status, 429)
    user.mfaState.lockedUntil = Date.now() - 1
    user.passwordUpdatedAt = new Date(Date.now() - 180 * 86400000)
    const expiredPasswordResult = await verify(enrolled.recoveryCodes[1], true)
    assert.equal(expiredPasswordResult.status, 200)
    assert.equal((await expiredPasswordResult.json()).redirect, '/change-password')
    cookie = verifiedCookie; user.password = 'changed-password'
    assert.equal((await request('/protected')).status, 401)
    assert.equal(isPendingMfaSession({ listKey: 'User', mfaVerified: false, pendingSince: Date.now() - 300000 }, user), false)
    assert.equal(isVerifiedMfaSession({ listKey: 'User', itemId: '1' }, user), false)
    console.log('Session isolation, enrollment, CSRF, replay, concurrent recovery, lockout and password invalidation passed')
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
