/**
 * 業主規則：前台的「刪除」是軟刪除（貼文 -> archived、會員 -> deleted），
 * 但後台必須保留「勾選 delete」硬刪除，方便央廣清掉測試貼文／測試帳號。
 * 這支測試守住兩件事：軟刪除 mutation 有掛上去，且沒有蓋掉 Keystone 產生的硬刪除。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const keystoneSource = fs.readFileSync(path.join(__dirname, 'keystone.ts'), 'utf8')
const extensionSource = fs.readFileSync(
  path.join(__dirname, 'utils', 'member-soft-delete-gql.ts'),
  'utf8'
)
const schemaSource = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8')

// 1. 軟刪除 extension 有掛進 extendGraphqlSchema
assert.match(
  keystoneSource,
  /memberSoftDeleteSchemaExtension\(schema\)/,
  'keystone.ts should install the member soft-delete schema extension'
)

// 2. 沒有移除／覆寫 Keystone 產生的硬刪除 mutation
for (const forbidden of [
  /delete fields\.deleteMember/,
  /delete fields\.deletePost/,
  /removeGeneratedMemberDeleteMutations/,
]) {
  assert.doesNotMatch(
    keystoneSource,
    forbidden,
    'CMS hard-delete mutations must stay in the generated schema'
  )
}
for (const forbidden of [/\bdeleteMember:/, /\bdeletePost:/]) {
  assert.doesNotMatch(
    extensionSource,
    forbidden,
    'the soft-delete extension must not override generated deleteMember / deletePost'
  )
}

// 3. 軟刪除只開兩個「本人」專用的 mutation
assert.match(extensionSource, /archiveMyPost: graphql\.field/)
assert.match(extensionSource, /deleteMyAccount: graphql\.field/)

// 4. schema.graphql 兩邊都在：後台硬刪除 + 前台軟刪除
for (const mutation of [
  'deleteMember(where: MemberWhereUniqueInput!): Member',
  'deleteMembers(where: [MemberWhereUniqueInput!]!): [Member]',
  'deletePost(where: PostWhereUniqueInput!): Post',
  'deletePosts(where: [PostWhereUniqueInput!]!): [Post]',
  'archiveMyPost(where: PostWhereUniqueInput!): Post',
  'deleteMyAccount: Member',
]) {
  assert.ok(
    schemaSource.includes(mutation),
    `schema.graphql should expose: ${mutation}`
  )
}

console.log('keystone.memberSoftDelete.test.js OK')
