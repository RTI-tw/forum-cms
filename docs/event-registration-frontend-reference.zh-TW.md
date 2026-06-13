# 活動報名前端開發參考

本文件整理 CMS 已實作的活動報名與現場報到 API，供前端串接使用。

活動報名與報到初版 CMS code changes 已落在 commit `6112c2d`；活動內容欄位後續已更新為 `content`、`images`、`externalLink`。

## 已實作範圍

- CMS lists：
  - `Event`
  - `EventRegistration`
- DB migration：
  - `packages/forum-cms/migrations/20260605120000_add_event_registration_lists/migration.sql`
  - `packages/forum-cms/migrations/20260608090000_update_event_content_fields/migration.sql`
- Custom GraphQL：
  - `eventBySlug`
  - `registerForEvent`
  - `myEventRegistrations`
  - `issueEventCheckInQrToken`
  - `previewEventCheckInToken`
  - `confirmEventCheckIn`
- CMS admin page：
  - `/event-checkin`

## Auth

前台會員 API 使用會員 session token：

```http
Authorization: Bearer <member-session-token>
```

需要會員 token 的 operations：

- `registerForEvent`
- `myEventRegistrations`
- `issueEventCheckInQrToken`

工作人員報到 API 使用 CMS admin session，不使用會員 bearer token：

- `previewEventCheckInToken`
- `confirmEventCheckIn`

## 活動查詢

`eventBySlug` 供前端活動頁查詢公開活動。此 query 不需要會員登入。

只會回傳 `published` 活動；草稿、關閉、取消或不存在會回傳 `null`。

`content` 是 CMS 以 Markdown editor 維護的 Markdown 字串；前端活動頁請用既有 Markdown renderer 顯示，並依前端既有規則處理 HTML sanitization。

```graphql
query EventBySlug($slug: String!) {
  eventBySlug(slug: $slug) {
    id
    title
    slug
    content
    externalLink
    images {
      id
      name
      urlOriginal
      altText
      caption
      sortOrder
    }
    status
    startAt
    endAt
    registrationStartAt
    registrationEndAt
    checkInStartAt
    checkInEndAt
    capacity
    registrationCount
    remainingCapacity
    isRegistrationOpen
  }
}
```

前端顯示「我要報名」按鈕時建議同時檢查：

- `eventBySlug` 不為 `null`
- `isRegistrationOpen === true`
- `remainingCapacity === null || remainingCapacity > 0`

後端 `registerForEvent` 仍會再次強制檢查活動狀態、報名期間、名額與重複報名。

## 報名

`registerForEvent` 需要會員登入。

```graphql
mutation RegisterForEvent($data: RegisterForEventInput!) {
  registerForEvent(data: $data) {
    id
    status
    registeredAt
    checkedInAt
    event {
      id
      title
      slug
      content
      externalLink
      images {
        id
        name
        urlOriginal
        altText
        caption
        sortOrder
      }
      startAt
      endAt
      checkInStartAt
      checkInEndAt
      capacity
      registrationCount
      remainingCapacity
      isRegistrationOpen
    }
  }
}
```

Variables:

```json
{
  "data": {
    "eventSlug": "example-event"
  }
}
```

活動報名不再收手機號碼、身分證或居留證欄位。

重複報名規則：

- 同一活動同一會員只能報名一次。

## 我的活動報名

`myEventRegistrations` 需要會員登入，用於個人頁顯示會員已報名活動。

```graphql
query MyEventRegistrations {
  myEventRegistrations {
    id
    status
    registeredAt
    checkedInAt
    event {
      id
      title
      slug
      content
      externalLink
      images {
        id
        name
        urlOriginal
        altText
        caption
        sortOrder
      }
      startAt
      endAt
      checkInStartAt
      checkInEndAt
      isRegistrationOpen
    }
  }
}
```

`status` 可能值：

- `registered`
- `checkedIn`
- `cancelled`

前端個人頁可針對 `registered` 狀態顯示 QR Code 入口。

## 會員 QR Token

`issueEventCheckInQrToken` 需要會員登入，前端個人頁用它取得 QR token。

```graphql
mutation IssueEventCheckInQrToken($registrationId: ID!) {
  issueEventCheckInQrToken(registrationId: $registrationId) {
    token
    issuedAt
  }
}
```

注意事項：

- token 是 opaque string，前端不要解析內容。
- token 目前沒有 expiration。
- token 仍是一次性使用：報到成功後同一 token 不能再報到。
- 每次重新發 token 會取代該報名紀錄目前儲存的 token hash，舊 token 會失效。
- token 原始值只回傳給前端；CMS DB 只存 hash。
- 報到仍受活動狀態與報到時間窗限制。

QR Code 內容可使用 raw token，例如：

```text
evtqr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

也可以使用帶 token query 的 URL，例如：

```text
https://example.com/event-checkin?token=evtqr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

CMS 端 token parser 支援 raw token 與 `?token=` URL。

## 現場報到流程

工作人員使用 CMS admin page：

```text
/event-checkin
```

掃描 QR Code 後，頁面會先呼叫 preview，不會直接報到。

Preview:

```graphql
query PreviewEventCheckInToken($token: String!) {
  previewEventCheckInToken(token: $token) {
    ok
    canCheckIn
    code
    message
    registrationId
    registrationStatus
    eventId
    eventTitle
    eventSlug
    memberId
    memberName
    memberNickname
    memberEmail
    registeredAt
    checkedInAt
  }
}
```

工作人員確認畫面內容後，才按確認報到。

Confirm:

```graphql
mutation ConfirmEventCheckIn($token: String!) {
  confirmEventCheckIn(token: $token) {
    ok
    canCheckIn
    code
    message
    registrationId
    registrationStatus
    eventTitle
    memberName
    memberNickname
    memberEmail
    registeredAt
    checkedInAt
  }
}
```

成功後回傳：

```text
code = CHECKED_IN
message = 報到成功
```

## 常見回應碼

報到 preview / confirm 可能回傳：

- `READY`：可報到。
- `CHECKED_IN`：報到成功。
- `INVALID_TOKEN`：QR token 無效。
- `TOKEN_USED`：QR token 已使用過。
- `ALREADY_CHECKED_IN`：此報名紀錄已完成報到。
- `REGISTRATION_CANCELLED`：此報名紀錄已取消。
- `REGISTRATION_NOT_ACTIVE`：此報名紀錄目前不可報到。
- `EVENT_NOT_PUBLISHED`：活動目前未開放報到。
- `CHECK_IN_NOT_STARTED`：活動尚未開始報到。
- `CHECK_IN_CLOSED`：活動報到已結束。

前端應以 `canCheckIn` 決定是否顯示確認報到按鈕，不要只用 `ok` 判斷。

## 前端建議流程

活動頁：

1. 用 `eventBySlug` 載入活動。
2. 未登入時導到 RtiTalk 登入/註冊。
3. 登入後顯示報名表。
4. 呼叫 `registerForEvent`。
5. 成功後導到個人頁或顯示報名成功狀態。

個人頁：

1. 用 `myEventRegistrations` 取得會員報名活動。
2. 對 `registered` 的報名紀錄提供 QR Code 按鈕。
3. 使用者打開 QR Code 時呼叫 `issueEventCheckInQrToken`。
4. 將回傳 token 轉成 QR Code。

工作人員報到：

1. 到 CMS `/event-checkin`。
2. 掃描 QR Code。
3. 確認 preview 顯示的活動與會員資訊。
4. 按確認報到。

## 非本次範圍

- 前 1000 名抽獎資格不在 DB model 處理，之後以人工 dump 報名與報到成功紀錄處理。
- 目前沒有前台取消報名 API。
- 目前沒有報到 undo API。
