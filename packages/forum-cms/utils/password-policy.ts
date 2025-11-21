const PASSWORD_MAX_AGE_DAYS = 90
const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const PASSWORD_MIN_LENGTH = 10
const LETTER_REGEX = /[A-Za-z]/
const DIGIT_REGEX = /\d/
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/
const PASSWORD_REQUIREMENT_MESSAGE = '密碼需至少 10 個字元，並包含英文字母、數字與特殊符號'

type PasswordPolicySubject = {
  passwordUpdatedAt?: string | Date | null
  mustChangePassword?: boolean | null
}

function getTimestamp(value?: string | Date | null) {
  if (!value) {
    return undefined
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.getTime()
}

export function isPasswordExpired(subject?: PasswordPolicySubject | null) {
  if (!subject) {
    return true
  }

  if (subject.mustChangePassword) {
    return true
  }

  const timestamp = getTimestamp(subject.passwordUpdatedAt)
  if (!timestamp) {
    return true
  }

  const age = Date.now() - timestamp
  return age >= PASSWORD_MAX_AGE_MS
}

export function isPasswordValid(subject?: PasswordPolicySubject | null) {
  return !isPasswordExpired(subject)
}

export function shouldForcePasswordChange(session?: { data?: PasswordPolicySubject | null }) {
  return isPasswordExpired(session?.data)
}

export function assertPasswordStrength(password: string) {
  if (typeof password !== 'string') {
    throw new Error(PASSWORD_REQUIREMENT_MESSAGE)
  }
  const value = password.trim()
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    !LETTER_REGEX.test(value) ||
    !DIGIT_REGEX.test(value) ||
    !SPECIAL_CHAR_REGEX.test(value)
  ) {
    throw new Error(PASSWORD_REQUIREMENT_MESSAGE)
  }
}

export const passwordPolicy = {
  maxAgeDays: PASSWORD_MAX_AGE_DAYS,
  maxAgeMs: PASSWORD_MAX_AGE_MS,
  minLength: PASSWORD_MIN_LENGTH,
  requirementsMessage: PASSWORD_REQUIREMENT_MESSAGE,
  isPasswordExpired,
  isPasswordValid,
  shouldForcePasswordChange,
  assertPasswordStrength,
}

