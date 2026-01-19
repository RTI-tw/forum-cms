# Lilith

## Monorepo setup
This is a monorepo containing sub-packages:
- [@mirrormedia/lilith-draft-renderer](./packages/draft-renderer): see `packages/draft-renderer`
- [@mirrormedia/lilith-draft-editor](./packages/draft-editor): see `packages/draft-editor`
- [@mirrormedia/lilith-core](./packages/core): see `packages/core`
- [@mirrormedia/lilith-editools](./packages/editools): see `packages/editools`
- [@mirrormedia/lilith-mesh](./packages/mesh): see `packages/mesh`
- [@mirrormedia/lilith-mirrormedia](./packages/mirrormedia): see `packages/mirrormedia`
- [@mirrormedia/lilith-readr](./packages/readr): see `packages/readr`
- [@mirrormedia/lilith-openrelationship](./packages/openrelationship): see `packages/openrelationship`
- [@mirrormedia/lilith-mirrordaily](./packages/mirrordaily): see `packages/mirrordaily`

This monorepo adopts `husky`, `lint-staged` and `yarn workspaces`. 
`husky` and `lint-staged` will 
1. run eslint for needed sub-packages before `git commit`

`yarn workspaces` will install dependencies of all the sub-packages wisely and effienciently.

## Development
Before modifying sub-packages' source codes, make sure you install dependencies on root. 
We need `husky` and `lint-staged` installed first.

## Installation
`yarn install`

## Troubleshootings
### Q1: 我在 root 資料夾底下跑 `yarn install` 時，在 `yarn postinstall` 階段發生錯誤。

A1: 如果錯誤訊息與 `@mirrormedia/lilith-core` 有關，可嘗試以下步驟來解決

1. 在 `packages/draft-renderer` 底下執行 `yarn build`
2. 在 `packages/draft-editor` 底下執行 `yarn build`
3. 在 `packages/core` 底下執行 `yarn build`
4. 在 root 底下執行 `yarn install`

確保 local 端有 `@mirrormedia-/lilith-core` 相關的檔案可以讓其他 package 載入。

### Q2: 針對在 Windows 環境開發，安裝階段時，發生與 `posinstall` script 有關錯誤的處理。

A2: 因為 `yarn workspace` 與個別 package 的 `postinstall` script 在 Windows 環境上是有問題的 [1](https://github.com/yarnpkg/yarn/issues/7694)，解法方式是安裝階段時不執行 `postinstall` script，等安裝完畢時，再到個別 package 底下去執行 `postinstall` script，步驟如下：
1. 在 root 底下執行 `set WINDOWS_ONLY=true && yarn install`
2. 到目標 package 底下執行 `set WINDOWS_ONLY=false && yarn postinstall`

## 前端會員登入 API（Firebase）

以下 API 用於前端會員登入（對應 `packages/forum-cms/lists/member.ts`），與 Admin UI 的 User 登入不同。

### GraphQL Endpoint
- `POST /api/graphql`

### 驗證流程（Firebase -> Keystone）
1. 前端用 Firebase Client SDK 登入，取得 `idToken`。
2. 呼叫 `authenticateMemberWithFirebase` 取得會員資料與後端 session token。
3. 後續請求帶 `Authorization: Bearer <sessionToken>`。

### Mutation：authenticateMemberWithFirebase
- 功能：驗證 Firebase ID token、建立/更新 Member、回傳後端 session token。

```
mutation AuthenticateMemberWithFirebase($data: AuthenticateMemberWithFirebaseInput!) {
  authenticateMemberWithFirebase(data: $data) {
    sessionToken
    expiresAt
    member {
      id
      firebaseId
      customId
      name
      nickname
      email
    }
  }
}
```

#### Variables 範例
```
{
  "data": {
    "idToken": "FIREBASE_ID_TOKEN",
    "name": "使用者名稱",
    "nickname": "暱稱",
    "customId": "自訂ID"
  }
}
```

#### 欄位規則（重要）
- `firebaseId` 由 Firebase token 的 `uid` 而來，為唯一鍵。
- `customId` 若未提供，預設為 `uid`。
- `name` / `nickname` 若未提供，依序使用 `Firebase displayName` / `email local-part` / `uid`。
- 若 `customId` 或 `email` 與其他 Firebase 帳號重複，會回錯誤。

### Query：authenticatedMember
- 功能：用後端 session token 取得目前登入會員。
- Header：`Authorization: Bearer <sessionToken>`

```
query AuthenticatedMember {
  authenticatedMember {
    id
    firebaseId
    customId
    name
    nickname
    email
  }
}
```

### 需要的環境變數（後端）
在 `packages/forum-cms` 的環境設定中請提供：
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` 或 `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `MEMBER_SESSION_SECRET`
- `MEMBER_SESSION_MAX_AGE`（秒）
