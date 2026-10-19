# CMS 登入由 reCAPTCHA v2 回到 TOTP：原始狀態與變更紀錄

- 起始日期：2026-10-15
- 原因：業主不接受 `999be6e`（reCAPTCHA v2 challenge）的登入方式，要求回到 `edacea8` 的 CMS TOTP。
- 範圍：dev、staging 於 2026-10-15 上線；業主確認後，prod 於 2026-10-19 上線。
- 決定事項：
  - 所有環境視為從未綁定 TOTP，使用者一律重新綁定，不從備份還原 `mfaState`。
  - prod 從未上過 TOTP，此次對 prod 是首次上線，不是退版。

GCP project `rti-project-486306`，region `asia-east1`。

## 一、為什麼不直接部署 `edacea8` 的舊 image

1. `999be6e` 的 migration `20261007090000_remove_cms_totp` 已在三個環境 DROP `User.mfaState`、`User.mfaRevision`。`_prisma_migrations` 仍記錄 `20261006090000_cms_totp` 已套用，`run.sh` 的 `prisma migrate deploy` 不會把欄位加回，舊程式查 User 會失敗；GQL 使用同一 image、同一 DB，前台也會受影響。
2. `edacea8` 使用 reCAPTCHA **v3**（`grecaptcha.execute` + score），目前各環境 trigger 與 Cloud Run 已換成 v2 key。
3. cms-prod、gql-prod、gql-dev 沒有 `CMS_MFA_ENCRYPTION_KEY`。

做法：新增一個 commit，程式回到 `edacea8`，保留 `remove_cms_totp` migration，另加 `20261015090000_restore_cms_totp` 以 `ADD COLUMN IF NOT EXISTS` 補回欄位。此 migration 只新增欄位，對目前 v2 版 revision 也相容，必要時可直接切回舊 revision。

## 二、原始狀態（2026-10-15 變更前）

Cloud Run 每個 revision 保留完整設定，需精確對照或還原時，以下列 revision 為準。

### Cloud Run

| 服務 | Revision | Image | `RECAPTCHA_SITE_KEY` | `RECAPTCHA_SECRET_KEY` | `CMS_MFA_ENCRYPTION_KEY` |
|---|---|---|---|---|---|
| rti-forum-cms-dev | `rti-forum-cms-dev-00171-q8l` | `main_999be6e` | `6LcpB-ItAAAAAIDFYVSPBVhKPiTz-t6A-2Oqy5yl` (v2) | `RECAPTCHA_V2_SECRET_KEY_DEV:1` | `CMS_MFA_ENCRYPTION_KEY:1` |
| rti-forum-gql-dev | `rti-forum-gql-dev-00151-pqh` | `main_f8c35f7` | `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza` (v3) | `RECAPTCHA_SECRET_KEY:latest` | （無） |
| rti-forum-cms-staging | `rti-forum-cms-staging-00039-wtk` | `staging_0af31a4` | `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka` (v2) | `RECAPTCHA_V2_SECRET_KEY_STAGING:1` | `CMS_MFA_ENCRYPTION_KEY_STAGING:1` |
| rti-forum-gql-staging | `rti-forum-gql-staging-00040-wd9` | `staging_0af31a4` | `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka` (v2) | `RECAPTCHA_V2_SECRET_KEY_STAGING:1` | `CMS_MFA_ENCRYPTION_KEY_STAGING:1` |
| rti-forum-cms-prod | `rti-forum-cms-prod-00023-nnw` | `prod_dc325d2` | `6LfL8OItAAAAAPN79YSvHZw_qHgw4IUzc2hTfuw_` (v2) | `RECAPTCHA_V2_SECRET_KEY_PROD:1` | （無） |
| rti-forum-gql-prod | `rti-forum-gql-prod-00026-wzt` | `prod_dc325d2` | `6LfL8OItAAAAAPN79YSvHZw_qHgw4IUzc2hTfuw_` (v2) | `RECAPTCHA_V2_SECRET_KEY_PROD:1` | （無） |

- 六個服務的執行身分皆為 `845066759721-compute@developer.gserviceaccount.com`，`RECAPTCHA_ENABLED=true`。
- 改 v2 之前，三個環境共用 v3 site key `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza` 與 secret `RECAPTCHA_SECRET_KEY`（例：`rti-forum-cms-staging-00036-rwc`、`rti-forum-cms-prod-00021-bnh`）。
- 環境變數中的 `CRON_SERVICES_GQL_WRITE_TOKEN` 為明文 token，此處不記錄其值。

### Cloud Build trigger（`cloudbuild.yaml`，SA 同上）

| Trigger | ID | 分支 | `_CLOUD_RUN_SERVICE_NAMES` | `_RECAPTCHA_SITE_KEY` |
|---|---|---|---|---|
| rti-forum-cms-dev | `985547a3-9a65-413e-a7c8-704b27b4f414` | `^main$` | `rti-forum-cms-dev` | `6LcpB-ItAAAAAIDFYVSPBVhKPiTz-t6A-2Oqy5yl` |
| rti-forum-cms-staging | `75bce621-f270-400d-b662-0302f608317a` | `^staging$` | `rti-forum-cms-staging,rti-forum-gql-staging` | `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka` |
| rti-forum-cms-prod | `d156e5c1-60e3-4d73-96e2-4906af5d0c08` | `^prod$` | `rti-forum-cms-prod,rti-forum-gql-prod` | `6LfL8OItAAAAAPN79YSvHZw_qHgw4IUzc2hTfuw_` |

三者其餘 substitutions 相同：`_IMAGE_NAME=rti-forum-cms`、`_RECAPTCHA_ENABLED=true`、`_SBOM_BUCKET=rti-fourm-sbom`、`_TARGET_PACKAGE=forum-cms`。

dev trigger 在 2026-07-30 以前的部署清單為 `rti-forum-cms-dev,rti-forum-gql-dev`。2026-10-06 先以手動執行覆寫為 `rti-forum-cms-dev`（因 gql-dev 沒有 MFA 金鑰），06:57 UTC 修改 trigger 時這個值被存成預設，gql-dev 因此停在 `main_f8c35f7`。

### 資料庫

| 環境 | Instance | Database | 備份 |
|---|---|---|---|
| dev | `rti-forum-cms-db` (PG15) | `forum_cms` | 未開自動備份；手動備份 2026-10-06 08:19、17:07 UTC |
| staging | `rti-forum-cms-db` (PG15) | `forum_cms_staging` | 同上 |
| prod | `rtitalk-prod` (PG18) | `forum_cms_prod` | 每日自動備份 + PITR（7 天） |

三個 DB 目前都沒有 `User.mfaState`、`User.mfaRevision`。

### Secret Manager（相關項目）

`CMS_MFA_ENCRYPTION_KEY`（version 1）、`CMS_MFA_ENCRYPTION_KEY_STAGING`、`RECAPTCHA_SECRET_KEY`（v3）、`RECAPTCHA_V2_SECRET_KEY_DEV`、`RECAPTCHA_V2_SECRET_KEY_STAGING`、`RECAPTCHA_V2_SECRET_KEY_PROD`。本次不刪除任何 secret。

## 三、變更紀錄

時間為 UTC。

| # | 時間 | 環境 | 對象 | 變更 | 變更前 → 變更後 |
|---|---|---|---|---|---|
| 1 | 2026-10-15 10:51 | dev/staging | Cloud SQL `rti-forum-cms-db` | On-demand 備份 | 備份 ID `1792061469547` |
| 2 | 2026-10-15 10:54 | dev | Cloud Run `rti-forum-gql-dev` | 掛上 MFA 金鑰（image 不變） | 無 → `CMS_MFA_ENCRYPTION_KEY=CMS_MFA_ENCRYPTION_KEY:1`；revision `00151-pqh` → `00152-9nh` |
| 3 | 2026-10-15 | — | Git 分支 `fix/restore-cms-totp` | `packages/forum-cms` 與 `yarn.lock` 回到 `edacea8`，刪除 v2 專用檔案，保留 `20261007090000_remove_cms_totp`，新增 `20261015090000_restore_cms_totp` | 與 `edacea8` 差異僅兩個 migration 資料夾 |
| 4 | 2026-10-15 10:56 | dev | Cloud Build trigger `rti-forum-cms-dev` | 恢復部署 gql-dev；build 用 site key 改回 v3（其他欄位不變；以 Cloud Build API PATCH 完整 trigger） | `_CLOUD_RUN_SERVICE_NAMES`: `rti-forum-cms-dev` → `rti-forum-cms-dev,rti-forum-gql-dev`；`_RECAPTCHA_SITE_KEY`: `6LcpB-ItAAAAAIDFYVSPBVhKPiTz-t6A-2Oqy5yl` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza` |
| 5 | 2026-10-15 10:57 | dev | Git `main` | Push commit `404ca80`（fast-forward，自 `fix/restore-cms-totp`），觸發 dev build | `main`: `999be6e` → `404ca80` |
| 6 | 2026-10-15 11:07–11:10 | dev | Cloud Build `0b62619a-e588-417a-b7db-0390b9527dc5` | 建置並部署 `main_404ca80` 至 cms-dev、gql-dev | gql-dev → `00153-qsm`（跟隨 latest，立即接流量）；cms-dev 建立 `00172-qcd`，但流量仍固定在 `00171-q8l` |
| 7 | 2026-10-15 11:09:59 | dev | DB `forum_cms` | gql-dev 啟動時套用 `20261015090000_restore_cms_totp` | `User.mfaState`、`User.mfaRevision`：無 → 已新增 |
| 8 | 2026-10-15 11:12 | dev | Cloud Run `rti-forum-cms-dev` | runtime reCAPTCHA 改回 v3 | `RECAPTCHA_SITE_KEY`: `6LcpB-ItAAAAAIDFYVSPBVhKPiTz-t6A-2Oqy5yl` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza`；`RECAPTCHA_SECRET_KEY`: `RECAPTCHA_V2_SECRET_KEY_DEV:1` → `RECAPTCHA_SECRET_KEY:latest`；新 revision `00173-pxf` |
| 9 | 2026-10-15 11:13 | dev | Cloud Run `rti-forum-cms-dev` 流量 | 流量由固定 revision 改為跟隨 latest | 100% `00171-q8l` → 100% LATEST（`00173-pxf`） |
| 10 | 2026-10-15 11:21 | dev/staging | Cloud SQL `rti-forum-cms-db` | staging 部署前 on-demand 備份 | 備份 ID `1792063274241` |
| 11 | 2026-10-15 11:22 | staging | Cloud Build trigger `rti-forum-cms-staging` | build 用 site key 改回 v3（其他欄位不變） | `_RECAPTCHA_SITE_KEY`: `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza` |
| 12 | 2026-10-15 11:22 | staging | Git `staging` | 合併 main（merge commit `782b058`，內容與 main `c93fe49` 相同），觸發 staging build | `staging`: `0af31a4` → `782b058` |
| 13 | 2026-10-15 11:23–11:25 | staging | Cloud Build `5d21511c-3424-4d3f-bc33-73d54a30ac1d` | 建置並部署 `staging_782b058` | 新 revision cms `00040-czm`、gql `00041-nr8`（流量仍固定在舊 revision，未啟動容器） |
| 14 | 2026-10-15 11:27 | staging | Cloud Run `rti-forum-cms-staging`、`rti-forum-gql-staging` | runtime reCAPTCHA 改回 v3 | `RECAPTCHA_SITE_KEY`: `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza`；`RECAPTCHA_SECRET_KEY`: `RECAPTCHA_V2_SECRET_KEY_STAGING:1` → `RECAPTCHA_SECRET_KEY:latest`；新 revision cms `00041-492`、gql `00042-r5h` |
| 15 | 2026-10-15 11:28 | staging | Cloud Run 流量 | 切換流量，維持固定 revision 方式 | cms: `00039-wtk` → `00041-492`；gql: `00040-wd9` → `00042-r5h` |
| 16 | 2026-10-15 11:28:23 | staging | DB `forum_cms_staging` | gql-staging 啟動時套用 `20261015090000_restore_cms_totp` | `User.mfaState`、`User.mfaRevision`：無 → 已新增 |
| 17 | 2026-10-19 02:24 | prod | Cloud SQL `rtitalk-prod` | prod 部署前 on-demand 備份 | 備份 ID `1792376666180` |
| 18 | 2026-10-19 02:26 | prod | Secret Manager | 建立 prod 專用 MFA 金鑰（`openssl rand -hex 32` 直接寫入，值未輸出） | 無 → `CMS_MFA_ENCRYPTION_KEY_PROD` version 1（automatic replication） |
| 19 | 2026-10-19 02:26 | prod | Cloud Build trigger `rti-forum-cms-prod` | build 用 site key 改回 v3（其他欄位不變） | `_RECAPTCHA_SITE_KEY`: `6LfL8OItAAAAAPN79YSvHZw_qHgw4IUzc2hTfuw_` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza` |
| 20 | 2026-10-19 02:26 | prod | Git `prod` | 合併 main（merge commit `ef433ef`，內容與 main `2d7b967` 相同），觸發 prod build | `prod`: `dc325d2` → `ef433ef` |
| 21 | 2026-10-19 02:27–02:29 | prod | Cloud Build `df2afbce-c9f2-48c8-9807-df8a21a0366c` | 建置並部署 `prod_ef433ef`（image digest `sha256:bc8334ce68b7…`，與 dev、staging 相同） | 新 revision cms `00024-bls`、gql `00027-qkw`（流量仍固定在舊 revision） |
| 22 | 2026-10-19 02:29 | prod | Cloud Run `rti-forum-cms-prod`、`rti-forum-gql-prod` | 掛上 MFA 金鑰、runtime reCAPTCHA 改回 v3 | `CMS_MFA_ENCRYPTION_KEY`：無 → `CMS_MFA_ENCRYPTION_KEY_PROD:1`；`RECAPTCHA_SITE_KEY`: `6LfL8OItAAAAAPN79YSvHZw_qHgw4IUzc2hTfuw_` → `6Lc6emYsAAAAAPa0IH1EeNf0jamwGAuf7up_3rza`；`RECAPTCHA_SECRET_KEY`: `RECAPTCHA_V2_SECRET_KEY_PROD:1` → `RECAPTCHA_SECRET_KEY:latest`；新 revision cms `00025-twt`、gql `00028-k85`（未接流量） |
| 23 | 2026-10-19 02:49:39 | prod | Cloud Run `rti-forum-gql-prod` 流量 | 切換流量，維持固定 revision 方式 | `00026-wzt` → `00028-k85` |
| 24 | 2026-10-19 02:49:58 | prod | DB `forum_cms_prod` | gql-prod 啟動時套用 `20261015090000_restore_cms_totp` | `User.mfaState`、`User.mfaRevision`：無 → 已新增 |
| 25 | 2026-10-19 02:51:42 | prod | Cloud Run `rti-forum-cms-prod` 流量 | 切換流量，維持固定 revision 方式；所有 CMS 使用者需重新登入並首次綁定 TOTP | `00023-nnw` → `00025-twt` |

### 部署時發現：Cloud Run 流量固定在指定 revision

2026-10-15 確認時，除 gql-dev 外，其餘五個服務的流量都固定在指定 revision（`spec.traffic` 為 `revisionName`，而非 `latestRevision: true`），為 2026-10-06～07 部署 v2 時設定。因此 `cloudbuild.yaml` 的 `gcloud run deploy` 只會建立新 revision，**不會切換流量**。dev 已於 #9 改為跟隨 latest；staging、prod 仍為固定 revision，部署後需手動切換流量（或比照 dev 改為 latest）。

### dev 驗證結果（2026-10-15 11:13 後）

| 項目 | 結果 |
|---|---|
| 本機 `totp`、`cms-mfa`、`password-policy`、`password-change-access` 測試 | 通過 |
| 本機 `tsc --noEmit`、`keystone build`（Node 24） | 通過 |
| Cloud Build | SUCCESS |
| Migration log | `Applying migration 20261015090000_restore_cms_totp` → `All migrations have been successfully applied.` |
| cms-dev `/health_check`、`/signin`、`/mfa` | 200 |
| cms-dev `/api/cms-mfa`（無 pending cookie） | 401「登入驗證已逾時，請重新輸入帳號密碼」，符合預期 |
| cms-dev signin bundle | 含 v3 site key `6Lc6emYs…` 與 `recaptcha/api.js`，不含 v2 key |
| gql-dev `/health_check`、GraphQL `posts` 查詢 | 200、正常回傳 |
| cms-dev、gql-dev ERROR log（11:09 起） | 無 |
| **CMS 實際登入、TOTP 首次綁定（QR）、驗證碼登入、復原碼、忘記密碼（v3）** | **待以實際帳號驗證** |

### staging 驗證結果（2026-10-15 11:29 後）

| 項目 | 結果 |
|---|---|
| Cloud Build | SUCCESS |
| Migration log | gql-staging 套用 `20261015090000_restore_cms_totp`；cms-staging 隨後顯示 `No pending migrations to apply.` |
| cms-staging `/health_check`、`/signin`、`/mfa` | 200 |
| cms-staging `/api/cms-mfa`（無 pending cookie） | 401，符合預期 |
| cms-staging signin bundle | 含 v3 site key `6Lc6emYs…`，不含 v2 key |
| gql-staging | invoker 僅限 compute service account（原本即如此，非本次變更），未帶身分的請求回 403 屬預期；無法以該身分直接查詢，尚未觀察到前台實際請求 |
| cms-staging、gql-staging ERROR log | 無 |
| **CMS 實際登入、TOTP 首次綁定、驗證碼登入、復原碼、忘記密碼（v3）；前台經 gql-staging 的功能** | **待以實際帳號驗證** |

### prod 上線前的 staging 測試紀錄

2026-10-19 依 log 確認 staging 自 10/15 起僅有：userId 4 首次綁定成功（10/15 12:57）；userId 7 兩次通過密碼並開啟驗證碼頁面但未送出（10/16 05:49、05:58）。沒有已綁定後的 TOTP 再登入或復原碼登入成功紀錄。已向負責人說明，負責人表示業主已在 staging 確認，指示直接上線。

### prod 驗證結果（2026-10-19 02:52）

| 項目 | 結果 |
|---|---|
| Cloud Build | SUCCESS |
| Migration log | gql-prod 套用 `20261015090000_restore_cms_totp`；cms-prod 隨後 `No pending migrations to apply.` |
| cms-prod `/health_check`、`/signin`、`/mfa` | 200 |
| cms-prod `/api/cms-mfa`（無 pending cookie） | 401，符合預期 |
| cms-prod signin bundle | 含 v3 site key `6Lc6emYs…`，不含 v2 key |
| gql-prod 切換後實際請求 | 17 筆，全部 200 |
| frontend-prod 首頁 | 200 |
| cms-prod、gql-prod ERROR log | 無 |
| **CMS 實際首次綁定（同時驗證 `CMS_MFA_ENCRYPTION_KEY_PROD` 格式）、TOTP 再登入、復原碼、忘記密碼（v3）** | **待實際帳號驗證** |

### prod 回復方式（必要時）

```
gcloud run services update-traffic rti-forum-cms-prod --region asia-east1 --to-revisions rti-forum-cms-prod-00023-nnw=100
gcloud run services update-traffic rti-forum-gql-prod --region asia-east1 --to-revisions rti-forum-gql-prod-00026-wzt=100
```

### staging 回復方式（必要時）

```
gcloud run services update-traffic rti-forum-cms-staging --region asia-east1 --to-revisions rti-forum-cms-staging-00039-wtk=100
gcloud run services update-traffic rti-forum-gql-staging --region asia-east1 --to-revisions rti-forum-gql-staging-00040-wd9=100
```

### dev 回復方式（必要時）

新增的欄位對 v2 版程式無影響，可直接切回舊 revision，不需動 DB：

```
gcloud run services update-traffic rti-forum-cms-dev --region asia-east1 --to-revisions rti-forum-cms-dev-00171-q8l=100
gcloud run services update-traffic rti-forum-gql-dev --region asia-east1 --to-revisions rti-forum-gql-dev-00152-9nh=100
```

若要讓之後 `main` 的 build 不再部署 gql-dev，或回到 v2 site key，依「二、原始狀態」的 trigger 值改回。

## 四、尚未進行

- prod：以實際帳號完成首次綁定、TOTP 再登入、復原碼、忘記密碼（v3）驗證。
- 建議：`rti-forum-cms-db` 開啟自動備份。
