import jwt from 'jsonwebtoken'
import envVar from '../environment-variables'

export type MemberSessionPayload = {
  memberId: string
  firebaseId: string
}

const DEFAULT_MEMBER_SESSION_MAX_AGE = 60 * 60 * 24 * 7

// [AUTH-001] 啟動時已在 environment-variables.ts 驗證 secret 不為空且長度足夠，
// 此處直接取用，不再提供 fallback（避免硬編碼預設值造成 session 偽造風險）。
function getSessionSecret(): string {
  return envVar.memberSession.secret
}

export function getMemberSessionMaxAgeSeconds() {
  const maxAge = envVar.memberSession.maxAgeSeconds
  return Number.isFinite(maxAge) && maxAge > 0
    ? maxAge
    : DEFAULT_MEMBER_SESSION_MAX_AGE
}

export function getMemberSessionExpiresAt() {
  const maxAgeSeconds = getMemberSessionMaxAgeSeconds()
  return new Date(Date.now() + maxAgeSeconds * 1000).toISOString()
}

export function signMemberSession(payload: MemberSessionPayload) {
  return jwt.sign(payload, getSessionSecret(), {
    expiresIn: getMemberSessionMaxAgeSeconds(),
  })
}

export function verifyMemberSession(token: string) {
  if (!token) {
    throw new Error('Member session token is required')
  }

  return jwt.verify(token, getSessionSecret()) as MemberSessionPayload
}
