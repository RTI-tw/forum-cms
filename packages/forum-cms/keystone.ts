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
import {
  isAccountLocked,
  shouldResetFailedAttempts,
  getAccountLockoutData,
  getLoginFailureMessage,
} from './utils/account-lockout'

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
  sessionData: 'id name role passwordUpdatedAt mustChangePassword accountLockedUntil',
  secretField: 'password',
  initFirstItem: {
    // If there are no items in the database, keystone will ask you to create
    // a new user, filling in these fields.
    fields: ['name', 'email', 'password', 'role'],
  },
})

const session = statelessSessions(envVar.session)

const CHANGE_PASSWORD_PATH = '/change-password'
const ACCOUNT_LOCKED_PATH = '/account-locked'
const MIN_PASSWORD_LENGTH = passwordPolicy.minLength
const PASSWORD_REQUIREMENT_MESSAGE = passwordPolicy.requirementsMessage

const JS_BACKTICK = '`'
const DOLLAR = '$'

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

const accountLockedPageTemplate = String.raw`
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function AccountLockedPage() {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkLockStatus = async () => {
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            query: ${JS_BACKTICK}
              query CheckAccountLock {
                authenticatedItem {
                  __typename
                  ... on User {
                    id
                    accountLockedUntil
                  }
                }
              }
            ${JS_BACKTICK},
          }),
        });

        const result = await response.json();
        const user = result.data?.authenticatedItem;

        // If user is logged in and locked, use server data
        if (user && user.__typename === 'User' && user.accountLockedUntil) {
          const lockUntil = new Date(user.accountLockedUntil).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));
          setRemainingSeconds(remaining);
          setIsChecking(false);
          
          if (remaining === 0) {
            window.location.replace('/signin');
          }
          return;
        }

        // If not logged in or not locked on server, check if we have local lockout state
        // This is set by the login page interceptor when it receives the lockout error
        const localLockout = localStorage.getItem('keystone-lockout-until');
        if (localLockout) {
          const lockUntil = parseInt(localLockout, 10);
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));
          
          if (remaining > 0) {
            setRemainingSeconds(remaining);
            setIsChecking(false);
            return;
          } else {
            // Expired
            localStorage.removeItem('keystone-lockout-until');
          }
        }

        // If we get here, we are neither locked on server nor locally
        // Redirect to signin
        window.location.replace('/signin');

      } catch (error) {
        console.error('Error checking lock status:', error);
        setIsChecking(false);
      }
    };

    checkLockStatus();
    interval = setInterval(checkLockStatus, 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return ${JS_BACKTICK}${DOLLAR}{mins}:${DOLLAR}{secs.toString().padStart(2, '0')}${JS_BACKTICK};
  };

  if (isChecking) {
    return (
      <>
        <Head>
          <title>檢查帳號狀態</title>
        </Head>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          }}
        >
          <div style={{ color: '#fff', fontSize: '18px' }}>檢查中...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>帳號已被鎖定</title>
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
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: '28px', color: '#0f172a', fontWeight: 700 }}>
            帳號已被鎖定
          </h1>
          
          <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '16px', lineHeight: 1.6 }}>
            由於多次登入失敗，您的帳號已被暫時鎖定以保護安全。
          </p>

          <div
            style={{
              background: '#f8fafc',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
            }}
          >
            <div style={{ color: '#475569', fontSize: '14px', marginBottom: '8px' }}>
              剩餘鎖定時間
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#dc2626',
                fontFamily: 'monospace',
              }}
            >
              {formatTime(remainingSeconds)}
            </div>
          </div>

          <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px', lineHeight: 1.6 }}>
            鎖定時間結束後，您將可以重新登入。為了帳號安全，請確保使用正確的密碼。
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/signin';
            }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: 'transparent',
              color: '#475569',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            返回登入頁面
          </button>
        </div>
      </div>
    </>
  );
}
`

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
      if (headers && headers.get && headers.get('X-Account-Locked') === 'true') {
        redirectTo('${ACCOUNT_LOCKED_PATH}');
        return;
      }
      if (headers && headers.get && headers.get('X-Require-Password-Change') === 'true') {
        redirectTo(CHANGE_PATH);
        return;
      }
    } catch (err) {}

    if (!payload) {
      return;
    }

    if (payload.errors && Array.isArray(payload.errors)) {
      for (var i = 0; i < payload.errors.length; i++) {
        var error = payload.errors[i];
        if (error.extensions && error.extensions.code === 'ACCOUNT_LOCKED') {
          redirectTo('${ACCOUNT_LOCKED_PATH}');
          return;
        }
      }
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
            // Check headers immediately - this is more reliable than cloning the response
            // as Apollo Client might consume the body before we can clone it
            if (response.headers && response.headers.get && response.headers.get('X-Account-Locked') === 'true') {

              // Store lockout time in localStorage (15 minutes from now)
              // Since we can't get the exact time from header, we estimate
              localStorage.setItem('keystone-lockout-until', (Date.now() + 15 * 60 * 1000).toString());
              redirectTo('${ACCOUNT_LOCKED_PATH}');
              return response;
            }

            try {
              // Only try to clone if we haven't redirected yet
              // Check if body is already used to avoid errors
              if (!response.bodyUsed) {
                var clone = response.clone();
                clone
                  .json()
                  .then(function (payload) {

                    if (payload.errors) {

                    }
                    handlePayload(payload, response.headers);
                  })
                  .catch(function (e) {
                    // Ignore JSON parse errors (e.g. if request was aborted)
                  });
              }
            } catch (err) {

            }
            return response;
          })
          .catch(function (e) {

          });
      }
    } catch (err) {

    }
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
      isAccessAllowed: (context) => {
        const { session, req } = context;
        const path = req?.url || '';

        // Allow access to change password page if user needs to change password
        if (path === CHANGE_PASSWORD_PATH || path.indexOf(CHANGE_PASSWORD_PATH) === 0) {
          return !!session;
        }

        // Allow access to account locked page without session
        if (path === ACCOUNT_LOCKED_PATH || path.indexOf(ACCOUNT_LOCKED_PATH) === 0) {
          return true;
        }

        // Check if user needs to change password
        if (session?.data) {
          if (
            session.data.mustChangePassword ||
            (session.data.passwordUpdatedAt &&
              isPasswordExpired({ passwordUpdatedAt: session.data.passwordUpdatedAt }))
          ) {
            // If accessing API or other pages, might want to block or allow
            // For now, we rely on the client-side script to redirect
            // But for the Admin UI, we might want to restrict access
          }
        }

        return !!session;
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
            outputPath: 'pages/account-locked.tsx',
            src: accountLockedPageTemplate,
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
              path === ACCOUNT_LOCKED_PATH ||
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
