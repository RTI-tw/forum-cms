# @mirrormedia/lilith-mesh

## Preface
此Repo
- 使用[KeystoneJS 6](https://keystonejs.com/docs)來產生CMS服務。
- 串接 Cloud Build 產生 Docker image 和部署到 Cloud Run 上。

cloud builds:
- [lilith-mesh-dev](https://console.cloud.google.com/cloud-build/triggers;region=global/edit/50587c44-d1e9-4eb2-9730-e8b4187afe2a?project=mirrormedia-1470651750304)
- [lilith-mesh-prod](https://console.cloud.google.com/cloud-build/triggers;region=global/edit/43dfcd36-d64d-4096-b49d-8443ea140e24?project=mirrormedia-1470651750304)

cloud runs:
- [readr-mesh-dev](https://console.cloud.google.com/run/detail/asia-east1/readr-mesh-dev?project=mirrormedia-1470651750304)
- [read-mesh-gql-dev](https://console.cloud.google.com/run/detail/asia-east1/readr-mesh-gql-dev?project=mirrormedia-1470651750304)
- [read-mesh](https://console.cloud.google.com/run/detail/asia-east1/readr-mesh?project=mirrormedia-1470651750304)
- [read-mesh-gql](https://console.cloud.google.com/run/detail/asia-east1/readr-mesh-gql?project=mirrormedia-1470651750304)

## Getting started on local environment
### Start postgres instance
在起 lilith-mesh 服務前，需要在 local 端先起 postgres database。
而我們可以透過 [Docker](https://docs.docker.com/) 快速起 postgres database。
在電腦上安裝 Docker 的方式，可以參考 [Docker 安裝文件](https://docs.docker.com/engine/install/)。
安裝 Docker 後，可以執行以下 command 來產生 local 端需要的 postgres 服務。
```
docker run -p 5433:5432 --name lilith-mesh -e POSTGRES_PASSWORD=passwd -e POSTGRES_USER=account -e POSTGRES_DB=lilith-mesh -d postgres
```

註：
`POSTGRES_PASSWORD`, `POSTGRES_USER` 和 `POSTGRES_DB` 都可更動。
只是要注意，改了後，在起 lilith-mesh 的服務時，也要更改傳入的 `DATABASE_URL` 環境變數。

### Install dependencies
我們透過 yarn 來安裝相關套件。
```
yarn install
```

### Start dev instance
確定 postgres 服務起來和相關套件安裝完畢後，可以執行以下 command 來起 lilith-mesh 服務
```
yarn dev
// or
npm run dev
```

如果你的 database 的設定與上述不同，
可以透過 `DATABASE_URL` 環境變數傳入。
```
DATABASE_URL=postgres://anotherAccount:anotherPasswd@localhost:5433/anotherDatabase yarn dev
// or
DATABASE_URL=postgres://anotherAccount:anotherPasswd@localhost:5433/anotherDatabase npm run dev
```

成功將服務起來後，使用瀏覽器打開 [http://localhost:3000](http://localhost:3000)，便可以開始使用 CMS 服務。

### GraphQL 瀏覽器 IDE（Apollo Sandbox）

Keystone 6 底層是 **Apollo Server 4**，開發環境（`NODE_ENV` 不是 `production`）下用瀏覽器直接開啟 [http://localhost:3000/api/graphql](http://localhost:3000/api/graphql)，通常會看到 **Apollo Sandbox**（內嵌的 GraphQL IDE），而不是早期 Keystone / Apollo 3 那種獨立的 **GraphQL Playground** 介面。

生產環境預設會關閉 playground／introspection；此時同一支網址只會當成 **API**，不會再提供瀏覽器 IDE。

若以 **POST** 呼叫 API，body 必須是 JSON，且含**非空**的 `query` 欄位，否則會得到：`GraphQL operations must contain a non-empty 'query' or a 'persistedQuery' extension`。例如：

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __typename }"}'
```

也可用 [Altair](https://altairgraphql.dev/)、Insomnia、Postman 等客戶端連到同一 endpoint。

### Start GraphQL API server only
我們也可以單獨把 lilith-mesh 當作 GraphQL API server 使用。
透過傳入 `IS_UI_DISABLED` 環境變數，我們可以把 CMS WEB UI 的部分關閉，只留下 GraphQL endpoint `/api/graphql`。
```
IS_UI_DISABLED=true npm run dev
```

### Access control
透過 `npm run dev` 起服務時，預設是起 CMS 的服務，所以我們必須是登入的狀態下，才能使用 GraphQL endpoint `http://localhost:3000/api/graphql`。
若是在登出的狀態下，我們是無法使用 GraphQL API 的。

除了 `cms` 權限控管模式，我們可以使用 `ACCESS_CONTROL_STRATEGY` 環境變數來切換不同的 GraphQL API 權限控管的模式。

| 策略值 | 說明 |
|--------|------|
| `cms`（預設） | 依 Admin 登入 session 的 role（admin / moderator / editor 等）決定各 list 的 query／mutation 權限。 |
| `gql` | 不檢查登入；**所有 list 的 GraphQL 操作一律允許**（等同全開）。僅適合有嚴格網路隔離的場景。 |
| `preview` | 與 `gql` 相同（全開），供預覽等用途。 |
| `api` | 不檢查 CMS role；改依環境變數 **`ACCESS_CONTROL_API_RULES_JSON`** 逐 **list** 設定只讀、可寫或關閉（見下方）。實作在 **`utils/access-control.ts`**。 |

#### `gql` 模式（全開）
```
ACCESS_CONTROL_STRATEGY=gql npm run dev
```
切換成 `gql` 模式後，GraphQL API server 就不會檢查使用者是否處於登入的狀態（意即 GraphQL API server 會處理所有的 requests）。
注意：`gql` 模式的使用上，需要搭配「不允許外部網路的限制」來部署程式碼，以免門戶大開。

#### `api` 模式（依 list 細部控管）
對外公開 GraphQL、又不想像 `gql` 一樣全開時，可使用 `api`：依 **Keystone list 名稱**（與程式中 `list({ ... })` 的 list key 一致，例如 `Post`、`Photo`、`Comment`）設定權限等級。

**環境變數**

| 變數 | 必填 | 說明 |
|------|------|------|
| `ACCESS_CONTROL_STRATEGY` | 是 | 設為 `api`。 |
| `ACCESS_CONTROL_API_RULES_JSON` | 強烈建議 | JSON 字串：物件的 **key** 為 list key，**value** 為下列字串之一。 |
| `ACCESS_CONTROL_API_DEFAULT` | 否 | 當某個 list **未**出現在 JSON 且也**沒有**使用 `"*"` 時的預設等級；可為 `none`、`read`、`read_write`。未設定時預設為 **`none`**（最安全）。 |

**每個 list 的等級（`ACCESS_CONTROL_API_RULES_JSON` 的值）**

| 值 | 效果 |
|----|------|
| `none` | 不可 query，也不可 create／update／delete。 |
| `read` | 僅允許 **query**（含單筆與列表）；所有 mutation 拒絕。 |
| `read_write` | query 與 create／update／delete 皆允許（仍不檢查 CMS 登入 role）。 |

**特殊 key `"*"`**（可選）：代表「任何未在 JSON 裡單獨列出的 list」的預設等級。若未設定 `"*"` 且也未設定 `ACCESS_CONTROL_API_DEFAULT` 可涵蓋的 list，則該 list 依 `ACCESS_CONTROL_API_DEFAULT` 處理（預設 `none`）。

**`User` list 與第一個管理員**：若資料庫中尚無任何 User，仍允許建立第一筆 User（與 `cms` 下 `allowRolesForUsers` 的行為一致），避免無法登入 Admin UI。

**本機範例**（單行 JSON，實際部署可用 Secret Manager 或多行 escape）：

```bash
ACCESS_CONTROL_STRATEGY=api \
ACCESS_CONTROL_API_RULES_JSON='{"Post":"read","Comment":"read_write","User":"none","Photo":"read","*":"none"}' \
npm run dev
```

**說明**：上例中 `Post`、`Photo` 僅可查詢；`Comment` 可查可寫；`User` 與其他未列名的 list 為 `none`（若某 list 未出現在 JSON，且設了 `"*":"none"`，則走 `none`）。

**注意**：`api` 仍不驗證「哪一位會員／使用者」；僅限制 list 讀寫。部署時請在 **網路與雲端身分**上限制誰能打到 GraphQL（例如 **Cloud Run 需驗證 + `roles/run.invoker`、內部 LB、VPC／subnet、IAP** 等），勿將 endpoint 暴露在未受控的公網。

### Profile 分頁：hidden 內容可見性規則（前端必讀）

為了解決 Profile「我的留言 / 我的投票 / 我的收藏」中，`hidden` 貼文需要區分「自己的」與「別人的」這個情境，後端已在 list access filter 統一加入貼文可見性規則（不需前端再手動寫跨層 OR）：

- `Post`、`Comment`、`Bookmark`、`PollVote` 都會套用同一套貼文可見性判斷。
- 未登入（無有效 member Bearer token）：只能看到 `post.status = published`。
- 已登入會員：
  - 可看到 `post.status = published`。
  - 也可看到 `post.status = hidden` 且 `post.author = 自己`。
  - **看不到** `post.status = hidden` 且 `post.author != 自己`。
- CMS 請求（Keystone session）不受此前台可見性限制。

#### 前端 where 寫法建議

Profile 分頁請只保留「我的資料」條件，不要再自行加 `post.status = published`（或 `poll.post.status = published`）：

1. 我的留言（`comments`）
   - 保留：`member.id = myId`
   - 保留（若要含留言本身隱藏態）：`status in ['published', 'hidden']`
   - 移除：`post.status = published`

2. 我的收藏（`bookmarks`）
   - 保留：`member.id = myId`
   - 移除：`post.status = published`

3. 我的投票（`pollVotes`）
   - 保留：`member.id = myId`
   - 移除：`poll.post.status = published`

範例（我的留言）：

```graphql
query MyComments($myId: ID!) {
  comments(
    where: {
      member: { id: { equals: $myId } }
      status: { in: [published, hidden] }
    }
  ) {
    id
    content
    status
    post {
      id
      status
      author {
        id
      }
    }
  }
}
```

> 顯示層建議：若回傳的 `post.status = hidden`，前端可加上 overlay（例如「此內容已隱藏」），但資料是否可見由後端規則決定。

### Troubleshootings
#### Q1: 我在 `packages/*` 資料夾底下跑 `yarn install` 時，在 `yarn postinstall` 階段發生錯誤。

A1: 如果錯誤訊息與 `@mirrormedia/lilith-core` 有關，可以嘗試先到 `packages/core` 底下，執行
  1. `yarn build`
  2. `yarn install`

確保 local 端有 `@mirrormedia-/lilith-core` 相關的檔案可以讓 `packages/*` 載入。

## Patch

### 目前使用 patch-package 讓 keystone admin UI (keystone-6/core 5.2.0) 可以在手機版進行編輯，該功能已在 keystone-6/core 5.5.1 新增，日後更新 keystone 板上時可移除。
