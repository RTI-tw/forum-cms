/**
 * 前台的「刪除」是軟刪除，後台的「勾選 delete」才是硬刪除：
 *
 * - `archiveMyPost`：作者本人把自己的貼文改成 archived（後台仍看得到該筆資料）
 * - `deleteMyAccount`：會員本人把自己的狀態改成 deleted（釋放 email／Firebase ID／自訂 ID）
 *
 * 兩者都是**額外**的 mutation，不覆寫也不移除 Keystone 產生的
 * deletePost／deletePosts／deleteMember／deleteMembers，
 * 後台仍可勾選 delete 真的刪掉測試資料。
 *
 * 目標物件一律由 member session token 反推（帳號）或比對作者（貼文），
 * 因此前台即使帶入別人的 id 也無法動到別人的資料。
 */
import { graphql } from '@keystone-6/core'
import type { KeystoneContext } from '@keystone-6/core/types'

import { softDeleteAuthenticatedMemberAccount } from './member-account-deletion'
import {
  archiveMemberPostByWhere,
  type PostWhereUniqueInput,
} from './post-archive'

export const memberSoftDeleteSchemaExtension = graphql.extend((base) => {
  const postType = base.object('Post')
  const memberType = base.object('Member')
  const postWhereUniqueInput = base.inputObject('PostWhereUniqueInput')

  return {
    mutation: {
      archiveMyPost: graphql.field({
        type: postType,
        args: {
          where: graphql.arg({
            type: graphql.nonNull(postWhereUniqueInput),
          }),
        },
        resolve(
          _root: unknown,
          { where }: { where: PostWhereUniqueInput },
          context: KeystoneContext
        ) {
          return archiveMemberPostByWhere(context, where)
        },
      }),
      deleteMyAccount: graphql.field({
        type: memberType,
        resolve(
          _root: unknown,
          _args: Record<string, unknown>,
          context: KeystoneContext
        ) {
          return softDeleteAuthenticatedMemberAccount(context)
        },
      }),
    },
  }
})
