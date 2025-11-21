import 'dotenv/config'
import { config, graphql } from '@keystone-6/core'
import { listDefinition as lists } from './lists'
import envVar from './environment-variables'
import express from 'express'
import { createAuth } from '@keystone-6/auth'
import { statelessSessions } from '@keystone-6/core/session'
import { createPreviewMiniApp } from './express-mini-apps/preview/app'
import Keyv from 'keyv'
import { KeyvAdapter } from '@apollo/utils.keyvadapter'
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl'
import responseCachePlugin from '@apollo/server-plugin-response-cache'
import { GraphQLConfig, KeystoneContext } from '@keystone-6/core/types'
import { utils } from '@mirrormedia/lilith-core'
import { createLoginLoggingPlugin } from './utils/login-logging'
import { assertPasswordStrength, isPasswordExpired, passwordPolicy } from './utils/password-policy'

// 获取 createLoginLoggingPlugin 函数（兼容新旧版本）
// const createLoginLoggingPlugin =
//   (utils as any).createLoginLoggingPlugin ||
//   (() => {
//     console.warn('createLoginLoggingPlugin not available, login logging disabled')
//     return {}
//   })

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  sessionData: 'id name role passwordUpdatedAt mustChangePassword',
  secretField: 'password',
  initFirstItem: {
    // If there are no items in the database, keystone will ask you to create
    // a new user, filling in these fields.
    fields: ['name', 'email', 'password', 'role'],
  },
})

const session = statelessSessions(envVar.session)

const CHANGE_PASSWORD_PATH = '/change-password'
const MIN_PASSWORD_LENGTH = passwordPolicy.minLength
const PASSWORD_REQUIREMENT_MESSAGE = passwordPolicy.requirementsMessage

const JS_BACKTICK = '`'

const ChangePasswordInput = graphql.inputObject({
  name: 'ChangeMyPasswordInput',
  fields: {
    password: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    confirmPassword: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
})

const ChangePasswordResult = graphql.object<{ success: boolean; message?: string }>()({
  name: 'ChangeMyPasswordResult',
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    message: graphql.field({ type: graphql.String }),
  },
})

const passwordSchemaExtension = graphql.extend(() => ({
  mutation: {
    changeMyPassword: graphql.field({
      type: graphql.nonNull(ChangePasswordResult),
      args: {
        data: graphql.arg({ type: graphql.nonNull(ChangePasswordInput) }),
      },
      async resolve(
        _root: unknown,
        { data }: { data: { password: string; confirmPassword: string } },
        context: KeystoneContext
      ) {
        const session = context.session

        if (!session?.itemId) {
          return {
            success: false,
            message: '尚未登入，請重新登入後再試一次。',
          }
        }

        const password =
          typeof data?.password === 'string' ? data.password.trim() : ''
        const confirmPassword =
          typeof data?.confirmPassword === 'string'
            ? data.confirmPassword.trim()
            : ''

        if (!password) {
          return {
            success: false,
            message: '請輸入新密碼',
          }
        }

        if (password !== confirmPassword) {
          return {
            success: false,
            message: '兩次輸入的密碼不一致',
          }
        }

        try {
          assertPasswordStrength(password)
        } catch (validationError) {
          return {
            success: false,
            message:
              validationError instanceof Error
                ? validationError.message
                : PASSWORD_REQUIREMENT_MESSAGE,
          }
        }

        try {
          const userId = String(session.itemId)
          const updatedUser = await context.sudo().db.User.updateOne({
            where: { id: userId },
            data: {
              password,
              passwordUpdatedAt: new Date().toISOString(),
              mustChangePassword: false,
            },
          })

          if (!updatedUser) {
            return {
              success: false,
              message: '找不到使用者資料',
            }
          }

          return {
            success: true,
            message: '密碼更新成功！',
          }
        } catch (error) {
          return {
            success: false,
            message: '更新密碼失敗，請稍後再試。',
          }
        }
      },
    }),
  },
}))

const changePasswordPageTemplate = String.raw`
import { FormEvent, useState } from 'react';
import Head from 'next/head';

const MUTATION = ${JS_BACKTICK}
  mutation ChangeMyPassword($data: ChangeMyPasswordInput!) {
    changeMyPassword(data: $data) {
      success
      message
    }
  }
${JS_BACKTICK};

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const PASSWORD_MESSAGE = '${passwordPolicy.requirementsMessage}';
  const LETTER_REGEX = /[A-Za-z]/;
  const DIGIT_REGEX = /[0-9]/;
  const SPECIAL_REGEX = /[^A-Za-z0-9]/;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword) {
      setStatus('error');
      setMessage('請輸入新密碼');
      return;
    }

    if (
      trimmedPassword.length < ${MIN_PASSWORD_LENGTH} ||
      !LETTER_REGEX.test(trimmedPassword) ||
      !DIGIT_REGEX.test(trimmedPassword) ||
      !SPECIAL_REGEX.test(trimmedPassword)
    ) {
      setStatus('error');
      setMessage(PASSWORD_MESSAGE);
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setStatus('error');
      setMessage('兩次輸入的密碼不一致');
      return;
    }

    setStatus('loading');
    setMessage('更新中...');

    try {
                                  const response = await fetch('/api/graphql', {
                                    method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
                                    credentials: 'include',
                                    body: JSON.stringify({
          query: MUTATION,
          variables: {
            data: {
              password: trimmedPassword,
              confirmPassword: trimmedConfirm,
            },
          },
        }),
                                  });
                                  
                                  const result = await response.json();

      if (!response.ok || result.errors?.length) {
        throw new Error(
          result.errors?.[0]?.message || '更新密碼失敗，請稍後再試。'
        );
      }

      if (!result.data?.changeMyPassword?.success) {
        throw new Error(result.data?.changeMyPassword?.message || '更新失敗');
      }

      setStatus('success');
      setMessage(result.data.changeMyPassword.message || '密碼更新成功！');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        window.location.replace('/');
      }, 1200);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || '更新密碼失敗，請稍後再試。');
    }
  };

  return (
    <>
      <Head>
        <title>請先更新密碼</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          margin: 0,
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
            padding: '32px',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: '24px', color: '#0f172a' }}>
            請先更新密碼
          </h1>
          <p style={{ margin: '0 0 24px', color: '#475569', lineHeight: 1.6 }}>
            為了確保帳號安全，系統要求您每三個月更新一次密碼。更新完成後即可繼續使用後台功能。
          </p>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              新密碼
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="至少 ${MIN_PASSWORD_LENGTH} 個字元"
                style={{
                  width: '100%',
                  marginTop: '6px',
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5f5',
                  fontSize: '16px',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              再次輸入新密碼
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  marginTop: '6px',
                  marginBottom: '12px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5f5',
                  fontSize: '16px',
                }}
              />
            </label>

            {message ? (
              <div
                style={{
                  marginBottom: '16px',
                  color: status === 'success' ? '#0f9d58' : status === 'error' ? '#d93025' : '#0f172a',
                  fontWeight: 500,
                }}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: '12px',
                background: status === 'loading' ? '#94a3b8' : '#2563eb',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600,
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              {status === 'loading' ? '更新中…' : '更新密碼'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/signin';
            }}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid #cbd5f5',
              background: 'transparent',
              color: '#475569',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            重新登入
          </button>
                              </div>
                              </div>
    </>
  );
}
`

const passwordEnforcerClientScript = `
(function () {
  var CHANGE_PATH = '${CHANGE_PASSWORD_PATH}';
  var PASSWORD_MAX_AGE = ${passwordPolicy.maxAgeMs};
  var CHECK_DELAY = 150;
  var checking = false;
  var pendingCheck = null;
  var redirecting = false;

  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  function currentPath() {
    if (typeof window === 'undefined' || !window.location) {
      return '/';
    }
    return window.location.pathname || '/';
  }

  function needsPasswordChange(user) {
    if (!user || typeof user !== 'object') {
      return false;
    }
    if (user.mustChangePassword) {
      return true;
    }
    if (!user.passwordUpdatedAt) {
      return true;
    }
    var ts = Date.parse(user.passwordUpdatedAt);
    if (isNaN(ts)) {
      return true;
    }
    return Date.now() - ts >= PASSWORD_MAX_AGE;
  }

  function redirectTo(path) {
    if (redirecting) {
      return;
    }
    redirecting = true;
    try {
      if (window.location.pathname === path) {
        redirecting = false;
        return;
      }
      window.location.replace(path);
    } catch (err) {
      redirecting = false;
    }
  }

  function handleUserState(user) {
    var path = currentPath();
    if (!user || user.__typename !== 'User') {
      if (path === CHANGE_PATH) {
        redirectTo('/signin');
      }
      return;
    }
    if (needsPasswordChange(user)) {
      if (path !== CHANGE_PATH) {
        redirectTo(CHANGE_PATH);
      }
      return;
    }
    if (path === CHANGE_PATH) {
      redirectTo('/');
    }
  }

  function handlePayload(payload, headers) {
    try {
      if (headers && headers.get && headers.get('X-Require-Password-Change') === 'true') {
        redirectTo(CHANGE_PATH);
        return;
      }
    } catch (err) {}

    if (!payload) {
      return;
    }

    if (payload.extensions && payload.extensions.requirePasswordChange) {
      redirectTo(CHANGE_PATH);
      return;
    }

    if (payload.data && payload.data.authenticatedItem) {
      handleUserState(payload.data.authenticatedItem);
    }

    if (payload.data) {
      try {
        var keys = Object.keys(payload.data);
        for (var i = 0; i < keys.length; i++) {
          var value = payload.data[keys[i]];
          if (
            value &&
            typeof value === 'object' &&
            value.__typename === 'UserAuthenticationWithPasswordSuccess'
          ) {
            if (value.item && (value.item.mustChangePassword || value.item.requirePasswordChange)) {
              redirectTo(CHANGE_PATH);
              return;
            }
          }
        }
      } catch (err) {}
    }
  }

  function scheduleCheck(delay) {
    if (pendingCheck) {
      clearTimeout(pendingCheck);
    }
    pendingCheck = window.setTimeout(runStatusCheck, typeof delay === 'number' ? delay : CHECK_DELAY);
  }

  function runStatusCheck() {
    if (checking || redirecting) {
      return;
    }
    checking = true;
    var path = currentPath();
    if (path === '/signin' || path.indexOf('/signin') === 0) {
      checking = false;
      return;
    }
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: ${JS_BACKTICK}
          query PasswordPolicyCheck {
            authenticatedItem {
              __typename
              ... on User {
                id
                mustChangePassword
                passwordUpdatedAt
              }
            }
          }
        ${JS_BACKTICK},
      }),
    })
      .then(function (response) {
        return response
          .clone()
          .json()
          .then(function (json) {
            handleUserState(json && json.data && json.data.authenticatedItem);
          })
          .catch(function () {});
      })
      .catch(function () {})
      .finally(function () {
        checking = false;
      });
  }

  var originalFetch = window.fetch;
  window.fetch = function () {
    var args = Array.prototype.slice.call(arguments);
    var result = originalFetch.apply(window, args);
    try {
      var url = (typeof args[0] === 'string' ? args[0] : args[0] && args[0].url) || '';
      if (typeof url === 'string' && url.indexOf('/api/graphql') !== -1) {
        result
          .then(function (response) {
            try {
              var clone = response.clone();
              clone
                .json()
                .then(function (payload) {
                  handlePayload(payload, response.headers);
                })
                .catch(function () {});
            } catch (err) {}
            return response;
          })
          .catch(function () {});
      }
    } catch (err) {}
    return result;
  };

  var push = window.history && window.history.pushState;
  var replace = window.history && window.history.replaceState;
  if (push) {
    window.history.pushState = function () {
      var out = push.apply(this, arguments);
      scheduleCheck(50);
      return out;
    };
  }
  if (replace) {
    window.history.replaceState = function () {
      var out = replace.apply(this, arguments);
      scheduleCheck(50);
      return out;
    };
  }
  window.addEventListener('popstate', function () {
    scheduleCheck(50);
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      scheduleCheck(50);
    }
  });

  scheduleCheck(50);
})();
`;

const adminDocumentTemplate = String.raw`
import Document, { Html, Head, Main, NextScript } from 'next/document';

const passwordEnforcerScript = ${JSON.stringify(passwordEnforcerClientScript)};

export default class CustomDocument extends Document {
  render() {
    return (
      <Html>
        <Head />
        <body>
          <script
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: passwordEnforcerScript }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
`

const graphqlConfig = {
  apolloConfig: {
    plugins: [
      createLoginLoggingPlugin(),
      ...(envVar.accessControlStrategy === 'gql' && envVar.cache.isEnabled
        ? [
            responseCachePlugin(),
            ApolloServerPluginCacheControl({
              defaultMaxAge: envVar.cache.maxAge,
            }),
          ]
        : []),
    ],
    ...(envVar.accessControlStrategy === 'gql' && envVar.cache.isEnabled
      ? {
          cache: new KeyvAdapter(
            new Keyv(envVar.cache.url, {
              lazyConnect: true,
              namespace: envVar.cache.identifier,
              connectionName: envVar.cache.identifier,
              connectTimeout: envVar.cache.connectTimeOut,
            })
          ),
        }
      : {}),
  } as any,
} as GraphQLConfig

export default withAuth(
  config({
    db: {
      provider: envVar.database.provider,
      url: envVar.database.url,
      idField: {
        kind: 'autoincrement',
      },
    },
    ui: {
      // If `isDisabled` is set to `true` then the Admin UI will be completely disabled.
      isDisabled: envVar.isUIDisabled,
      // For our starter, we check that someone has session data before letting them see the Admin UI.
      isAccessAllowed: async (context) => {
        if (!context.session?.data) {
          return false
        }
        return true
      },
      getAdditionalFiles: [
        async () => [
          {
            mode: 'write' as const,
            outputPath: 'pages/change-password.tsx',
            src: changePasswordPageTemplate,
          },
          {
            mode: 'write' as const,
            outputPath: 'pages/_document.tsx',
            src: adminDocumentTemplate,
          },
        ],
      ],
    },
    graphql: graphqlConfig as any,
    lists,
    session,
    extendGraphqlSchema: passwordSchemaExtension,
    storage: {
      files: {
        kind: 'local',
        type: 'file',
        storagePath: envVar.files.storagePath,
        serverRoute: {
          path: '/files',
        },
        generateUrl: (path) => `${envVar.files.baseUrl}${path}`,
      },
      images: {
        kind: 'local',
        type: 'image',
        storagePath: envVar.images.storagePath,
        serverRoute: {
          path: '/images',
        },
        generateUrl: (path) => `${envVar.images.baseUrl}${path}`,
      },
    },
    server: {
      healthCheck: {
        path: '/health_check',
        data: { status: 'healthy' },
      },
      maxFileSize: 2000 * 1024 * 1024,
      extendExpressApp: (app, context) => {
        app.use(express.json({ limit: '500mb' }))

        app.use(async (req, res, next) => {
          try {
            const path = req.path || ''

            const shouldSkip =
            req.method !== 'GET' ||
              path === CHANGE_PASSWORD_PATH ||
              path === '/signin' ||
              path === '/init' ||
              path === '/health_check' ||
              path.startsWith('/api') ||
              path.startsWith('/_next') ||
              path.startsWith('/static') ||
              path.startsWith('/files') ||
              path.startsWith('/images') ||
              /\.[a-zA-Z0-9]+$/.test(path)

            if (shouldSkip) {
            return next()
          }
            
            const keystoneContext = await context.withRequest(req, res)
            const sessionData = keystoneContext.session?.data

            if (!sessionData?.id) {
              if (path === CHANGE_PASSWORD_PATH) {
                return res.redirect('/signin')
              }
              return next()
            }

            let requiresChange = isPasswordExpired({
              passwordUpdatedAt: sessionData.passwordUpdatedAt,
              mustChangePassword: sessionData.mustChangePassword,
            })

            if (!requiresChange) {
              const fresh = await keystoneContext.sudo().query.User.findOne({
                where: { id: sessionData.id },
                query: 'passwordUpdatedAt mustChangePassword',
              })
              requiresChange = isPasswordExpired(fresh)
            }

            if (requiresChange && path !== CHANGE_PASSWORD_PATH) {
              return res.redirect(CHANGE_PASSWORD_PATH)
            }

            if (!requiresChange && path === CHANGE_PASSWORD_PATH) {
              return res.redirect('/')
                                  }
                                } catch (error) {
            console.error(
              JSON.stringify({
                severity: 'ERROR',
                message: 'Password enforcement middleware error',
                type: 'EXPRESS_PASSWORD_POLICY',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              })
            )
            }

          next()
        })

        //if (envVar.accessControlStrategy === 'cms') {
        //  app.use(
        //    createPreviewMiniApp({
        //      previewServer: envVar.previewServer,
        //      keystoneContext: context,
        //    })
        //  )
        //}
      },
    },
  })
)
