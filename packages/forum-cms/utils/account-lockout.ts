/**
 * Account Lockout Utilities
 * 
 * Provides functions to manage login failure tracking and account lockout.
 */

export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export interface UserLockoutData {
    loginFailedAttempts?: number
    accountLockedUntil?: string | null
    lastFailedLoginAt?: string | null
}

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(user: UserLockoutData | null | undefined): boolean {
    if (!user?.accountLockedUntil) {
        return false
    }

    const lockoutTime = new Date(user.accountLockedUntil).getTime()
    const now = Date.now()

    return lockoutTime > now
}

/**
 * Calculate remaining lockout time in minutes
 */
export function getRemainingLockoutMinutes(user: UserLockoutData | null | undefined): number {
    if (!user?.accountLockedUntil) {
        return 0
    }

    const lockoutTime = new Date(user.accountLockedUntil).getTime()
    const now = Date.now()
    const remainingMs = lockoutTime - now

    if (remainingMs <= 0) {
        return 0
    }

    return Math.ceil(remainingMs / 60000)
}

/**
 * Check if failed attempts should be reset (lockout period has expired)
 */
export function shouldResetFailedAttempts(user: UserLockoutData | null | undefined): boolean {
    if (!user?.accountLockedUntil) {
        return false
    }

    const lockoutTime = new Date(user.accountLockedUntil).getTime()
    const now = Date.now()

    // If lockout time has passed, we should reset
    return lockoutTime <= now
}

/**
 * Calculate the data to update after a login attempt
 */
export function getAccountLockoutData(
    isSuccess: boolean,
    currentUser: UserLockoutData | null | undefined
): Partial<UserLockoutData> {
    const now = new Date().toISOString()

    if (isSuccess) {
        // Reset everything on successful login
        return {
            loginFailedAttempts: 0,
            accountLockedUntil: null,
            lastFailedLoginAt: null,
        }
    }

    // Login failed
    const currentAttempts = currentUser?.loginFailedAttempts || 0
    const newAttempts = currentAttempts + 1

    const updateData: Partial<UserLockoutData> = {
        loginFailedAttempts: newAttempts,
        lastFailedLoginAt: now,
    }

    // Lock account if max attempts reached
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
        updateData.accountLockedUntil = lockUntil.toISOString()
    }

    return updateData
}

/**
 * Get user-friendly error message for login failure
 */
export function getLoginFailureMessage(
    currentUser: UserLockoutData | null | undefined,
    isLocked: boolean
): string {
    if (isLocked) {
        const remainingMinutes = getRemainingLockoutMinutes(currentUser)
        return `帳號已被鎖定，請在 ${remainingMinutes} 分鐘後再試`
    }

    const attempts = currentUser?.loginFailedAttempts || 0
    const remaining = MAX_LOGIN_ATTEMPTS - attempts - 1

    if (remaining > 0) {
        return `認證失敗 (剩餘嘗試次數: ${remaining})`
    }

    return '登入失敗次數過多，帳號已被鎖定 15 分鐘'
}
