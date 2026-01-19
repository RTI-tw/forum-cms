import jwt from 'jsonwebtoken'
import envVar from '../environment-variables'

export type MemberSessionPayload = {
  memberId: string
  firebaseId: string
}

const DEFAULT_MEMBER_SESSION_SECRET =
  'default_member_session_secret_change_me'
const DEFAULT_MEMBER_SESSION_MAX_AGE = 60 * 60 * 24 * 7

function getSessionSecret() {
  return envVar.memberSession.secret || DEFAULT_MEMBER_SESSION_SECRET
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
