import { isPasswordExpired } from './password-policy'
import {
  isAccountLocked,
  shouldResetFailedAttempts,
  getAccountLockoutData,
  getLoginFailureMessage,
} from './account-lockout'
import { GraphQLError } from 'graphql'

export const createLoginLoggingPlugin = () => {
  return {
    async requestDidStart(requestContext: any) {
      // Capture client IP from request
      const clientIp =
        requestContext.contextValue?.req?.headers?.['x-forwarded-for'] ||
        requestContext.contextValue?.req?.socket?.remoteAddress ||
        requestContext.request?.http?.headers?.get('x-forwarded-for') ||
        ''

      // Check if this is an authentication request
      const operationName = requestContext.request?.operationName
      const query = requestContext.request?.query || ''
      const isAuthRequest =
        query.includes('authenticateUserWithPassword') ||
        operationName === 'AuthenticateUserWithPassword'

      // Pre-authentication: Check account lockout status
      // We'll do the check here but store the result to be used in responseForOperation
      // This avoids throwing in requestDidStart which causes a 500 error
      let lockoutError: GraphQLError | null = null;

      if (isAuthRequest && requestContext.request?.variables) {
        // KeystoneJS uses 'identity' not 'email'
        const identity = requestContext.request.variables.identity

        if (identity && requestContext.contextValue) {
          try {
            const user = await requestContext.contextValue.sudo().query.User.findOne({
              where: { email: identity },
              query: 'id loginFailedAttempts accountLockedUntil lastFailedLoginAt',
            })

            if (user) {
              // Check if account is locked
              if (isAccountLocked(user)) {
                const errorMessage = getLoginFailureMessage(user, true)

                lockoutError = new GraphQLError(errorMessage, {
                  extensions: {
                    code: 'ACCOUNT_LOCKED',
                  },
                })
              }

              // If lockout period has expired, reset failed attempts
              if (shouldResetFailedAttempts(user)) {
                await requestContext.contextValue.sudo().db.User.updateOne({
                  where: { id: user.id },
                  data: {
                    loginFailedAttempts: 0,
                    accountLockedUntil: null,
                    lastFailedLoginAt: null,
                  },
                })
              }
            }
          } catch (error) {
            console.error('Error checking account lockout:', error)
          }
        }
      }

      return {
        async responseForOperation() {
          if (lockoutError) {
            return {
              http: {
                status: 200,
                headers: new Map([['X-Account-Locked', 'true']]),
              },
              body: {
                kind: 'single',
                singleResult: {
                  errors: [lockoutError],
                },
              },
            }
          }
          return null;
        },

        async willSendResponse(requestContext: any) {
          const { response, contextValue } = requestContext // Keystone context is in contextValue

          if (
            response.body.kind === 'single' &&
            'singleResult' in response.body
          ) {
            const data = response.body.singleResult.data

            if (data) {
              // Iterate over all keys to find authentication responses
              for (const key of Object.keys(data)) {
                const result = data[key]

                // Check if the result looks like an authentication response
                // It should have either a sessionToken (success) 
                // or be of type UserAuthenticationWithPasswordFailure
                if (
                  result &&
                  typeof result === 'object' &&
                  (
                    result.__typename === 'UserAuthenticationWithPasswordSuccess' ||
                    result.__typename === 'UserAuthenticationWithPasswordFailure' ||
                    'sessionToken' in result
                  )
                ) {

                  const isSuccess =
                    result.__typename === 'UserAuthenticationWithPasswordSuccess' ||
                    !!result.sessionToken

                  let extraUserData: any = {};
                  // For failed logins, result.item is undefined, so get email from request variables
                  // KeystoneJS uses 'identity' and 'secret' as variable names, not 'email' and 'password'
                  let userEmail = result.item?.email || requestContext.request?.variables?.identity;

                  // Update lockout data based on authentication result
                  if (contextValue && userEmail) {
                    try {
                      // Find the user to update lockout data
                      const user = await contextValue.sudo().query.User.findOne({
                        where: { email: userEmail },
                        query: 'id email name loginFailedAttempts accountLockedUntil lastFailedLoginAt passwordUpdatedAt mustChangePassword',
                      })

                      if (user) {
                        // Calculate lockout data update
                        const lockoutData = getAccountLockoutData(isSuccess, user)

                        // Update user with lockout data
                        await contextValue.sudo().db.User.updateOne({
                          where: { id: user.id },
                          data: lockoutData,
                        })

                        // Prepare extra data for logging
                        const needsPasswordUpdate = isPasswordExpired(user)
                        const isLocked = isAccountLocked({ ...user, ...lockoutData })

                        extraUserData = {
                          userName: user.name,
                          userEmail: user.email,
                          mustChangePassword: user.mustChangePassword,
                          passwordUpdatedAt: user.passwordUpdatedAt,
                          requiresPasswordChange: needsPasswordUpdate,
                          loginFailedAttempts: isSuccess ? 0 : (lockoutData.loginFailedAttempts || 0),
                          accountLocked: isLocked,
                        };

                        // If account is locked, set header to trigger redirect
                        if (isLocked && requestContext.contextValue?.res) {
                          requestContext.contextValue.res.setHeader('X-Account-Locked', 'true')
                        }

                        // If user needs to change password, modify the response
                        if (needsPasswordUpdate && requestContext.contextValue?.res) {
                          const res = requestContext.contextValue.res
                          res.setHeader('X-Require-Password-Change', 'true')

                          if (result.__typename === 'UserAuthenticationWithPasswordSuccess' && result.item) {
                            result.item.requirePasswordChange = true
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Error updating lockout data:', e);
                    }
                  } else if (isSuccess && result.item?.id && contextValue) {
                    try {
                      // Fetch the user to get extra fields not requested by the client
                      const user = await contextValue.sudo().db.User.findOne({
                        where: { id: result.item.id },
                        query: 'id name email passwordUpdatedAt mustChangePassword'
                      });

                      if (user) {
                        const needsPasswordUpdate = isPasswordExpired(user)

                        extraUserData = {
                          userName: user.name,
                          userEmail: user.email,
                          mustChangePassword: user.mustChangePassword,
                          passwordUpdatedAt: user.passwordUpdatedAt,
                          requiresPasswordChange: needsPasswordUpdate,
                        };

                        // If user needs to change password, modify the response
                        if (needsPasswordUpdate && requestContext.contextValue?.res) {
                          const res = requestContext.contextValue.res
                          res.setHeader('X-Require-Password-Change', 'true')

                          if (result.__typename === 'UserAuthenticationWithPasswordSuccess' && result.item) {
                            result.item.requirePasswordChange = true
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Error fetching user details for logging:', e);
                    }
                  }

                  const log = {
                    severity: isSuccess ? 'INFO' : 'WARNING',
                    message: isSuccess
                      ? 'User logged in successfully'
                      : 'User login failed',
                    type: 'LOGIN',
                    status: isSuccess ? 'success' : 'failure',
                    timestamp: new Date().toISOString(),
                    remoteIp: clientIp,
                    ...(isSuccess
                      ? {
                        userId: result.item?.id,
                        userName: extraUserData.userName || result.item?.name,
                        userEmail: extraUserData.userEmail || result.item?.email,
                        mustChangePassword: extraUserData.mustChangePassword ?? result.item?.mustChangePassword,
                        passwordUpdatedAt: extraUserData.passwordUpdatedAt ?? result.item?.passwordUpdatedAt,
                        requiresPasswordChange: extraUserData.requiresPasswordChange,
                      }
                      : {
                        failureReason: result.message || 'Unknown error',
                        loginFailedAttempts: extraUserData.loginFailedAttempts,
                        accountLocked: extraUserData.accountLocked,
                      }),
                  }
                  console.log(JSON.stringify(log))
                }
              }
            }
          }
        },
      }
    },
  }
}
