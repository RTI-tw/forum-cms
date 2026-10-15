# CMS 登入由 reCAPTCHA v2 回到 TOTP：原始狀態與變更紀錄

- 起始日期：2026-10-15
- 原因：業主不接受 `999be6e`（reCAPTCHA v2 challenge）的登入方式，要求回到 `edacea8` 的 CMS TOTP。
- 範圍：本階段只推進到 **dev**，供業主驗證。staging、prod 依業主回覆再進行。
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

### dev 回復方式（必要時）

新增的欄位對 v2 版程式無影響，可直接切回舊 revision，不需動 DB：

```
gcloud run services update-traffic rti-forum-cms-dev --region asia-east1 --to-revisions rti-forum-cms-dev-00171-q8l=100
gcloud run services update-traffic rti-forum-gql-dev --region asia-east1 --to-revisions rti-forum-gql-dev-00152-9nh=100
```

若要讓之後 `main` 的 build 不再部署 gql-dev，或回到 v2 site key，依「二、原始狀態」的 trigger 值改回。

## 四、尚未進行（待業主回覆）

- staging：trigger `_RECAPTCHA_SITE_KEY` 改回 v3、Cloud Run `RECAPTCHA_SITE_KEY`／`RECAPTCHA_SECRET_KEY` 改回 v3、合併 main 至 `staging`；部署後切換 cms-staging、gql-staging 流量（目前固定 revision）。
- prod：建立 `CMS_MFA_ENCRYPTION_KEY_PROD`（獨立金鑰）並掛到 cms-prod、gql-prod；trigger 與 Cloud Run reCAPTCHA 改回 v3；部署前 on-demand 備份；部署後切換 cms-prod、gql-prod 流量（目前固定 revision）；通知 CMS 使用者首次登入需綁定 TOTP。
- 建議：`rti-forum-cms-db` 開啟自動備份。
