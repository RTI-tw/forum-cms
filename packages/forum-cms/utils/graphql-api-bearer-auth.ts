import type { NextFunction, Request, Response } from 'express'
import { timingSafeEqual } from 'node:crypto'

const GRAPHQL_PATH = '/api/graphql'

function parseBearer(authorization: string | undefined): string | null {
  if (!authorization || typeof authorization !== 'string') {
    return null
  }
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim())
  return m ? m[1] : null
}

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) {
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/**
 * 當 ACCESS_CONTROL_STRATEGY=api 時：
 * - `NODE_ENV=production`：必須設定 `ACCESS_CONTROL_API_BEARER_TOKEN`，並驗證 `Authorization: Bearer`；未設定 token 時回 503。
 * - 非 production：未設定 token 時略過 Bearer 檢查（方便本機）；若有設定則仍驗證（可模擬正式行為）。
 * OPTIONS 不檢查（供 CORS preflight）。
 */
export function createGraphqlApiBearerMiddleware(options: {
  strategy: string
  expectedBearerToken: string
  isProduction: boolean
}) {
  const { strategy, expectedBearerToken, isProduction } = options
  if (strategy !== 'api') {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path || ''
    if (!path.startsWith(GRAPHQL_PATH)) {
      return next()
    }
    if (req.method === 'OPTIONS') {
      return next()
    }

    if (isProduction && !expectedBearerToken) {
      res.status(503).json({
        errors: [
          {
            message:
              'ACCESS_CONTROL_API_BEARER_TOKEN is required when ACCESS_CONTROL_STRATEGY=api and NODE_ENV=production',
          },
        ],
      })
      return
    }

    if (!isProduction && !expectedBearerToken) {
      return next()
    }

    const token = parseBearer(req.headers.authorization)
    if (!token || !safeEqual(token, expectedBearerToken)) {
      res.status(401).json({
        errors: [{ message: 'Unauthorized' }],
      })
      return
    }

    next()
  }
}
