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
node node_modules/ts-node/dist/bin.js --transpile-only --compiler-options '{"module":"CommonJS"}' utils/password-change-access.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@keystone-6/core/bin/cli.js build
```

`cms-mfa.test.ts` 使用真正簽章加密的 Keystone session cookie 與本機 HTTP 端點；資料庫介面由記憶體測試替身提供，不能視為部署或實際資料庫的整合驗證。本機 Node 26 與既有套件相容性不足，這次使用 Node 24 完成建置。

## Staging 與 prod 部署 note

更新日期：2026-10-06。TOTP 與密碼政策已部署至 dev；staging、prod 尚未在本次工作中部署。以下設定需在各目標環境分別確認。

### Dev 已完成的部署

- 分支 `dev`，版本 `c215fc85b51555d9496dc461292efcf5dd5159bd`，包含 TOTP、180 天密碼效期與密碼過期後的更新流程修正。
- GCP project `rti-project-486306`、region `asia-east1`、Cloud Run `rti-forum-cms-dev`。
- 映像 `gcr.io/rti-project-486306/rti-forum-cms:dev_c215fc8`；revision `rti-forum-cms-dev-00166-xbr` 接收 100% 流量。
- Secret Manager `CMS_MFA_ENCRYPTION_KEY` 的 version `1` 已注入服務。
- Migration `20261006090000_cms_totp` 已成功套用。
- 雲端建置、健康檢查、登入頁及 MFA 未登入時回應 401 已驗證；實際帳號搭配手機驗證器的完整流程仍須完成驗收。

### 上 staging 或 prod 前需要修改的設定

| 項目 | 需要修改或確認的部分 |
| --- | --- |
| 程式版本 | 將已驗收的變更合併至目標環境實際使用的分支，包含 migration；確認建置來源 commit，不要直接沿用 dev 的 revision 名稱。 |
| GCP 與服務 | 確認目標 project、region、CMS service、部署 service account 與資料庫。staging／prod 的實際名稱應以各環境現有設定為準。 |
| 加密金鑰 | 在目標環境 Secret Manager 建立 `CMS_MFA_ENCRYPTION_KEY`，值為安全產生的 64 位十六進位字元，並注入 Cloud Run。資料庫彼此獨立時使用不同金鑰，不複製 dev 金鑰。 |
| Secret 權限 | 確認 Cloud Run 執行身分可讀取指定的 secret version；若缺少權限，只授予目標 secret 必要的存取權。建置身分與服務執行身分可能不同。 |
| 同環境多個服務 | 此程式在伺服器啟動時強制檢查金鑰。同一映像若同時部署 CMS、GraphQL 或其他服務，每個服務都必須配置金鑰；共用含 MFA 狀態的同一資料庫者須使用相同金鑰。只部署 CMS 時，限制部署服務清單為 CMS。 |
| 既有設定 | 保留既有 `DATABASE_URL`、`SESSION_SECRET`、`MEMBER_SESSION_SECRET`、reCAPTCHA 與儲存設定；不要用一組新環境變數覆蓋整份服務設定。 |
| 建置參數 | 核對 `_TARGET_PACKAGE=forum-cms`、`_IMAGE_NAME`、`_CLOUD_RUN_SERVICE_NAMES`、環境對應的 reCAPTCHA 參數及 `_SBOM_BUCKET`。 |
| Migration | 確認目標資料庫備份及待執行 migrations。容器 `run.sh` 會先執行 `yarn db-migrate` 再啟動服務，會套用所有未套用的 migrations，不只本次 TOTP migration。 |
| 流量 | 建立 revision 後確認 Ready，再明確切換至指定 revision；本次 dev 建置成功後仍保留舊流量設定，需另行切換 100%。 |

同一 GCP project 中若有多個互相獨立的環境，可使用不同 secret 名稱，再映射至相同環境變數 `CMS_MFA_ENCRYPTION_KEY`。部署時固定指定 secret version，保留原版金鑰與回復所需的設定。

### 建置與發布順序

1. 在 staging 先完成實際資料庫、驗證器與各角色驗收，再將同一份已驗收程式變更發布至 prod。
2. 確認目標分支包含所有 MFA 變更與 migration，核對目標資料庫備份與未套用 migrations。
3. 建立或確認目標環境的金鑰、secret version 與服務執行身分讀取權限；先配置所有將使用新映像的服務。
4. 以目標環境的 Cloud Build trigger 建置正確分支，明確指定此次部署服務清單。現有 `cloudbuild.yaml` 的部署 region 寫死為 `asia-east1`；若目標環境在其他 region，需先修改建置設定。
5. 確認 build 成功、revision 的映像 commit 正確、服務啟動成功，以及 migration log 出現 `All migrations have been successfully applied.`。
6. 確認新 revision Ready，將流量切換至指定 revision，再以實際服務網址驗證。

流量切換指令範本（將變數填入經確認的目標值後執行）：

```bash
gcloud run services update-traffic "$TARGET_SERVICE" \
  --project="$TARGET_PROJECT" \
  --region="$TARGET_REGION" \
  --to-revisions="$TARGET_REVISION=100"
```

### 自動部署分支注意事項

截至本次 dev 部署，既有 Cloud Build trigger `rti-forum-cms-dev`（ID `985547a3-9a65-413e-a7c8-704b27b4f414`，位置 `global`）仍追蹤 `main`，預設部署清單為 `rti-forum-cms-dev,rti-forum-gql-dev`。

本次是手動以 `dev` 執行 trigger，並將 `_CLOUD_RUN_SERVICE_NAMES` 覆寫為 `rti-forum-cms-dev`。因此後續 `main` 自動部署可能覆蓋此次 dev 版本。正式發布前需確認分支策略：將變更合併至既有 trigger 追蹤的分支，或修改 trigger 使各環境追蹤對應分支。若恢復同時部署 gql-dev，必須先為該服務配置必要金鑰。

Staging／prod 的 trigger 分支、位置與預設服務清單需另外核對，不沿用上述 dev trigger ID。

### 上線驗收與使用者通知

- `/health_check` 回應 200，`/signin` 與 `/mfa` 正常載入；未登入的 `/api/cms-mfa` 回應 401。
- 使用實際帳號完成首次綁定、保存 10 組復原碼、登出及再次 TOTP 登入。
- 驗證錯誤驗證碼、成功驗證碼重複使用、復原碼重複使用及五次失敗後鎖定。
- 驗證 180 天密碼到期後，可在完成 TOTP 後變更密碼；新密碼至少 13 位，含字母、數字及特殊字元，且不能等於目前密碼或前兩次密碼。
- 驗證 Admin、Editor、Partner 權限，以及前台 Member 登入與既有 GraphQL 功能。
- 上線前通知 CMS 使用者：舊登入 session 會失效，首次登入需要驗證器 App；目前採手動輸入設定金鑰，完成後需保存復原碼。安排遺失驗證器與復原碼時的身分確認及維運重設窗口。

### 回復與金鑰保存

回復時切換至已確認可用的舊 revision，保留新增資料欄位、secret 與原版金鑰，不刪除 MFA 狀態或回退資料庫 migration。回復到尚未包含 MFA 的版本會恢復舊版登入行為，應由發布負責人確認後執行。

金鑰不可在每次部署重新產生。資料庫還原或複製到另一環境時，既有 MFA 狀態與加密金鑰必須一起規劃；只換金鑰會使已綁定的驗證器密鑰無法解密。金鑰輪替、MFA 重設與跨環境資料複製應另外安排流程。
