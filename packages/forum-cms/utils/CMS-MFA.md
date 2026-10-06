# CMS TOTP 登入

所有 CMS User（Admin、Editor、Partner）登入時都必須完成 TOTP。前台 Firebase Member 登入維持既有流程。

## 使用方式

1. 帳號密碼通過後進入 `/mfa`，此時尚無 CMS 權限。
2. 首次登入在 Google Authenticator 或 Microsoft Authenticator 選擇手動新增，輸入畫面上的帳戶與設定金鑰，類型選時間型。輸入六位數驗證碼才完成綁定。
3. 保存畫面顯示的 10 組復原碼；每組只能用一次，伺服器僅保存雜湊。復原碼可下載，頁面關閉後不再提供原碼。
4. 後續登入輸入 TOTP；手機遺失可選「改用復原碼」。兩者都需要先通過密碼驗證。
5. 密碼到期者在第二因素通過後才進入改密碼頁；密碼變更會讓現有登入憑證失效，須重新登入。

## 部署

- 先配置 `CMS_MFA_ENCRYPTION_KEY`：獨立產生的 32 bytes 隨機金鑰，以 64 個十六進位字元表示，透過部署環境的 Secret 管理注入。勿寫入 Git、前端環境變數或 log。
- 執行資料庫 migration `20261006090000_cms_totp`，新增 `User.mfaState` 與 `User.mfaRevision`，再部署程式。新欄位不出現在 GraphQL 或管理表單。
- 伺服器缺少或設定錯誤的加密金鑰時會拒絕啟動，避免無保護的登入。
- 保留並安全備份加密金鑰；換掉金鑰會讓既有驗證器密鑰無法解密，需另外安排金鑰輪替。
- 確保伺服器時鐘準確（NTP）。採 SHA-1、六位數、30 秒，接受前後各一個時間窗；成功使用過的時間步不再接受。
- 待驗證狀態效期 5 分鐘，不會被 Keystone 視為登入 session。五次驗證失敗鎖定 15 分鐘，失敗計數及一次性消耗透過資料庫原子更新，跨實例生效。
- 舊的單密碼 session 在部署後失效，所有使用者須重新登入並首次綁定。
- 上線前在測試環境以實際資料庫及驗證器 App 驗證首次綁定、再次登入、復原碼、密碼到期及各角色 API 權限。

若驗證器及全部復原碼都遺失，必須由有資料庫維運權限的人員在確認使用者身分後重設該帳號的 MFA 狀態，再要求重新綁定。一般 CMS 使用者或管理員不能透過 GraphQL 清除 MFA。密碼重設也不會清除 TOTP。

## 本機驗證

在 `packages/forum-cms` 目錄執行：

```
node node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"CommonJS"}' utils/totp.test.ts
node node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"CommonJS"}' utils/cms-mfa.test.ts
node node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"CommonJS"}' utils/password-policy.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@keystone-6/core/bin/cli.js build
```

`cms-mfa.test.ts` 使用真正簽章加密的 Keystone session cookie 與本機 HTTP 端點；資料庫介面由記憶體測試替身提供，不能視為部署或實際資料庫的整合驗證。本機 Node 26 與既有套件相容性不足，這次使用 Node 24 完成建置。
