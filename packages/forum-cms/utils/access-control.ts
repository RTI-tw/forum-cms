/**
 * 包裝 @mirrormedia/lilith-core 的 accessControl：在 ACCESS_CONTROL_STRATEGY=api 時
 * 依 ACCESS_CONTROL_API_RULES_JSON 限制各 list，其餘策略仍完全使用 core 行為。
 */
import type {
  BaseAccessArgs,
  AccessOperation,
} from '@keystone-6/core/dist/declarations/src/types/config/access-control'
import type {
  BaseListTypeInfo,
  ListOperationAccessControl,
  MaybePromise,
} from '@keystone-6/core/types'
import { utils } from '@mirrormedia/lilith-core'

import { isApiAccessAllowed } from './api-access-rules'

const core = utils.accessControl

type ACLCheckFunction = (
  auth: BaseAccessArgs<BaseListTypeInfo>
) => MaybePromise<boolean>

type ListACLFunction = (
  ...args: ACLCheckFunction[]
) => ListOperationAccessControl<AccessOperation, BaseListTypeInfo>

function getListOperation(
  auth: BaseAccessArgs<BaseListTypeInfo>
): 'query' | 'create' | 'update' | 'delete' | undefined {
  const op = (
    auth as BaseAccessArgs<BaseListTypeInfo> & { operation?: string }
  ).operation
  if (
    op === 'query' ||
    op === 'create' ||
    op === 'update' ||
    op === 'delete'
  ) {
    return op
  }
  return undefined
}

const isNeedToTurnOffAccessControl: ACLCheckFunction = async (auth) => {
  const users = await auth.context.prisma.user.findMany()
  return users.length === 0
}

export const admin = core.admin
export const moderator = core.moderator
export const editor = core.editor
export const contributor = core.contributor
export const owner = core.owner

export const allowRoles: ListACLFunction = (...args) => {
  if (process.env.ACCESS_CONTROL_STRATEGY === 'api') {
    return async (auth) => {
      const listKey = auth.listKey
      const operation = getListOperation(auth)
      return isApiAccessAllowed(listKey, operation)
    }
  }
  return core.allowRoles(...args)
}

export const allowRolesForUsers: ListACLFunction = (...args) => {
  if (process.env.ACCESS_CONTROL_STRATEGY === 'api') {
    return async (auth) => {
      const canCreateFirstUser = await isNeedToTurnOffAccessControl(auth)
      if (canCreateFirstUser) {
        return true
      }
      const listKey = auth.listKey
      const operation = getListOperation(auth)
      return isApiAccessAllowed(listKey, operation)
    }
  }
  return core.allowRolesForUsers(...args)
}
