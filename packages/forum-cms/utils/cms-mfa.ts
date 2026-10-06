import type { Express } from 'express'
import { randomUUID } from 'crypto'
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, passwordFingerprint, recoveryCodeHash, verifyTotp } from './totp'
import { isPasswordExpired } from './password-policy'
import { enrollmentQrCode } from './mfa-qr'

const PENDING_MAX_AGE = 5 * 60 * 1000
const LOCK_DURATION = 15 * 60 * 1000
export type MfaState = {
  secret?: string; version?: string; lastStep?: number; recoveryHashes?: string[];
  failures?: number; lockedUntil?: number;
}
export function isVerifiedMfaSession(session: any, user: any): boolean {
  return Boolean(session?.listKey === 'User' && session?.mfaVerified === true && user?.mfaState?.secret &&
    typeof user.mfaState.version === 'string' &&
    session.mfaVersion === user.mfaState.version &&
    session.passwordFingerprint === passwordFingerprint(user.password))
}
export function isPendingMfaSession(session: any, user: any, now = Date.now()): boolean {
  return Boolean(session?.listKey === 'User' && session?.mfaVerified === false &&
    typeof session.pendingSince === 'number' && session.pendingSince <= now &&
    now - session.pendingSince < PENDING_MAX_AGE && user &&
    session.passwordFingerprint === passwordFingerprint(user.password))
}
function isSameOriginRequest(req: any): boolean {
  try {
    return req.get('X-CMS-MFA') === '1' && Boolean(req.is('application/json')) &&
      Boolean(req.get('Origin')) && new URL(req.get('Origin')).host === req.get('Host')
  } catch { return false }
}

/** Pending cookies are never exposed as Keystone sessions, including via bearer auth. */
export function createCmsMfa(rawSession: any) {
  const loadUser = (context: any, itemId: any) => context.sudo().prisma.user.findUnique({ where: { id: Number(itemId) } })
  const strategy = {
    ...rawSession,
    async start({ context, data }: any) {
      if (data.listKey !== 'User') throw new Error('Unsupported CMS session')
      const user = await loadUser(context, data.itemId)
      if (!user) throw new Error('登入失敗')
      if ((user.mfaState?.lockedUntil || 0) > Date.now()) throw new Error('驗證嘗試過多，請於 15 分鐘後再試')
      return rawSession.start({ context, data: {
        listKey: 'User', itemId: String(user.id), mfaVerified: false,
        pendingSince: Date.now(), passwordFingerprint: passwordFingerprint(user.password),
        // An enrollment secret belongs to this signed pending cookie; it cannot replace an enrolled secret.
        pendingSecret: user.mfaState?.secret ? undefined : encryptTotpSecret(generateTotpSecret(), String(user.id)),
      } })
    },
    async get({ context }: any) {
      const candidate = await rawSession.get({ context })
      if (candidate?.listKey !== 'User' || candidate.mfaVerified !== true) return undefined
      const user = await loadUser(context, candidate.itemId)
      return isVerifiedMfaSession(candidate, user) ? candidate : undefined
    },
  }
  function mount(app: Express, baseContext: any) {
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || (req.path !== '/' && req.path !== '/init')) return next()
      try {
        const context = await baseContext.withRequest(req, res)
        const candidate = await rawSession.get({ context })
        if (candidate?.mfaVerified !== false) return next()
        const user = await loadUser(context, candidate.itemId)
        if (isPendingMfaSession(candidate, user)) return res.redirect('/mfa')
      } catch { /* The normal auth middleware handles invalid/expired cookies. */ }
      next()
    })
    app.use('/api/cms-mfa', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
    app.get('/api/cms-mfa', async (req, res) => {
      try {
        const context = await baseContext.withRequest(req, res)
        const candidate = await rawSession.get({ context })
        const user = candidate?.itemId ? await loadUser(context, candidate.itemId) : null
        if (isVerifiedMfaSession(candidate, user)) return res.json({ authenticated: true })
        if (!isPendingMfaSession(candidate, user)) return res.status(401).json({ message: '登入驗證已逾時，請重新輸入帳號密碼' })
        if ((user.mfaState?.lockedUntil || 0) > Date.now()) return res.status(429).json({ message: '驗證嘗試過多，請於 15 分鐘後再試' })
        const enrollment = !user.mfaState?.secret
        const secret = enrollment ? decryptTotpSecret(candidate.pendingSecret, String(user.id)) : undefined
        // A rendering failure must leave manual enrollment available.
        const qrCodeDataUrl = secret ? await enrollmentQrCode(secret, user.email).catch(() => undefined) : undefined
        return res.json({ enrollment, secret, email: user.email, qrCodeDataUrl })
      } catch { return res.status(503).json({ message: '無法載入驗證設定，請稍後再試' }) }
    })
    app.post('/api/cms-mfa', async (req, res) => {
      // Custom header plus same-origin validation prevent cross-site enrollment/login.
      if (!isSameOriginRequest(req)) {
        return res.status(403).json({ message: '無效的驗證請求' })
      }
      try {
        const context = await baseContext.withRequest(req, res)
        const candidate = await rawSession.get({ context })
        const user = candidate?.itemId ? await loadUser(context, candidate.itemId) : null
        if (!isPendingMfaSession(candidate, user)) return res.status(401).json({ message: '登入驗證已逾時，請重新輸入帳號密碼' })
        const state: MfaState = user.mfaState || {}
        if ((state.lockedUntil || 0) > Date.now() || (user.accountLockedUntil && new Date(user.accountLockedUntil).getTime() > Date.now())) {
          return res.status(429).json({ message: '帳號已被鎖定，請稍後再試' })
        }
        // Reserve an attempt before checking the code. Concurrent requests cannot
        // evaluate unlimited guesses against the same failure counter.
        const failures = (state.lockedUntil && state.lockedUntil <= Date.now() ? 0 : state.failures || 0) + 1
        const attempted: MfaState = { ...state, failures, lockedUntil: failures >= 5 ? Date.now() + LOCK_DURATION : 0 }
        const reserved = await context.sudo().prisma.user.updateMany({
          where: { id: user.id, mfaRevision: user.mfaRevision, password: user.password },
          data: { mfaState: attempted, mfaRevision: { increment: 1 } },
        })
        if (reserved.count !== 1) return res.status(409).json({ message: '驗證狀態已更新，請重新輸入新的驗證碼' })
        const enrollment = !state.secret
        const secret = decryptTotpSecret(enrollment ? candidate.pendingSecret : state.secret!, String(user.id))
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
        const useRecovery = req.body?.useRecovery === true
        const recoveryHash = recoveryCodeHash(code)
        const recoveryIndex = !enrollment && useRecovery ? (state.recoveryHashes || []).indexOf(recoveryHash) : -1
        const step = useRecovery ? null : verifyTotp(secret, code, state.lastStep ?? -1)
        const success = step !== null || recoveryIndex >= 0
        let recoveryCodes: string[] | undefined
        let next: MfaState
        if (success) {
          recoveryCodes = enrollment ? generateRecoveryCodes() : undefined
          next = {
            ...state, secret: enrollment ? encryptTotpSecret(secret, String(user.id)) : state.secret,
            version: state.version || randomUUID(), failures: 0, lockedUntil: 0,
            lastStep: step ?? state.lastStep,
            recoveryHashes: enrollment ? recoveryCodes!.map(recoveryCodeHash) :
              (state.recoveryHashes || []).filter((_, index) => index !== recoveryIndex),
          }
        } else {
          return res.status(400).json({ message: attempted.lockedUntil ? '驗證嘗試過多，請於 15 分鐘後再試' : '驗證碼錯誤、已使用或已過期，請重新輸入' })
        }
        // Atomic compare-and-swap prevents reuse of an OTP/recovery code and enrollment races across replicas.
        const updated = await context.sudo().prisma.user.updateMany({
          where: { id: user.id, mfaRevision: user.mfaRevision + 1, password: user.password },
          data: { mfaState: next, mfaRevision: { increment: 1 } },
        })
        if (updated.count !== 1) return res.status(409).json({ message: '驗證狀態已更新，請重新輸入新的驗證碼' })
        await rawSession.start({ context, data: {
          listKey: 'User', itemId: String(user.id), mfaVerified: true,
          mfaVersion: next.version, passwordFingerprint: passwordFingerprint(user.password),
        } })
        console.log(JSON.stringify({ type: 'CMS_MFA_SUCCESS', userId: user.id, enrollment, recovery: useRecovery }))
        return res.json({ success: true, recoveryCodes, redirect: isPasswordExpired(user) ? '/change-password' : '/' })
      } catch {
        return res.status(503).json({ message: '驗證暫時無法使用，請稍後再試' })
      }
    })
  }
  return { strategy, mount }
}
