import { isPasswordExpired } from './password-policy'

export const createLoginLoggingPlugin = () => {
  return {
    async requestDidStart(requestContext: any) {
      // Capture client IP from request
      const clientIp =
        requestContext.contextValue?.req?.headers?.['x-forwarded-for'] ||
        requestContext.contextValue?.req?.socket?.remoteAddress ||
        requestContext.request?.http?.headers?.get('x-forwarded-for') ||
        ''

      return {
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
                    
                    let extraUserData = {};
                    
                    if (isSuccess && result.item?.id && contextValue) {
                        try {
                            // Fetch the user to get extra fields not requested by the client
                            // We use sudo() to ensure we have permission to read these fields if necessary,
                            // though usually login logging happens in a privileged context or we just read public fields.
                            // Assuming contextValue is the Keystone Context.
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
                                // to include a redirect instruction in the GraphQL response itself
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
                            // Use fetched data if available, fallback to result item (which might be missing fields)
                            userName: extraUserData.userName || result.item?.name,
                            userEmail: extraUserData.userEmail || result.item?.email,
                            mustChangePassword: extraUserData.mustChangePassword ?? result.item?.mustChangePassword,
                            passwordUpdatedAt: extraUserData.passwordUpdatedAt ?? result.item?.passwordUpdatedAt,
                            requiresPasswordChange: extraUserData.requiresPasswordChange,
                          }
                        : {
                            failureReason: result.message || 'Unknown error',
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
