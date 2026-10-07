# CMS reCAPTCHA v2 與 TOTP 回退

登入與忘記密碼頁使用 reCAPTCHA v2「我不是機器人」核取方塊。Google 依風險決定是否出現圖形或音訊 challenge，不保證每次都出題。reCAPTCHA 是人機驗證，不是多因子驗證。

密碼政策保留：至少 13 位、含字母／數字／特殊字元、180 天效期，以及最近三次密碼不可重複。密碼過期後仍可透過受限制的 session 變更密碼。

## 環境設定

- 使用 CHECKBOX 類型 key；不可沿用 SCORE 類型 v3 key。
- 前端建置使用 `_RECAPTCHA_ENABLED=true`、`_RECAPTCHA_SITE_KEY`。
- Cloud Run 執行環境使用 `RECAPTCHA_ENABLED=true`、`RECAPTCHA_SITE_KEY`，以及對應的 `RECAPTCHA_SECRET_KEY` Secret Manager 引用。
- dev：site key `6LcpB-ItAAAAAIDFYVSPBVhKPiTz-t6A-2Oqy5yl`；secret `RECAPTCHA_V2_SECRET_KEY_DEV:1`。
- staging：site key `6LdiNeItAAAAAPHTxNqbJISgWhRMwcNaD76CQyka`；secret `RECAPTCHA_V2_SECRET_KEY_STAGING:1`。
- 只允許各環境實際使用的 CMS 網域。新網域需先加入 key 的 allowedDomains。
- 後端以 SiteVerify 驗證 token 的 success，不再檢查 v3 score/action。失敗、過期、重複 token 或服務錯誤皆拒絕登入。
- 前端 token 過期會失效，每次送出後 reset widget，重試需要重新驗證。

## 部署順序

1. 備份資料庫與記錄舊 revision／設定。
2. 建立各環境 v2 key、保存 secret，確認服務原有讀取權限。
3. 修改對應 Cloud Build trigger 的 site key，以及 Cloud Run 的 site key／secret 引用。先建立不接收流量的 revision，避免舊版 v3 與新版 key 不相容。
4. 將程式推至 main（dev）及 staging（staging），確認 Cloud Build 成功。
5. 切換新 revision 時，run.sh 執行 `20261007090000_remove_cms_totp`，移除 User.mfaState、User.mfaRevision，包括原綁定與復原碼雜湊資料。既有新增欄位 migration 保留，不修改歷史紀錄。
6. 確認 Ready、migration 成功、登入／忘記密碼頁可見核取方塊，以及沒有 token 的登入請求遭拒。
7. 新版本成功啟動後，移除 Cloud Run 的 `CMS_MFA_ENCRYPTION_KEY` 引用。保留 Secret Manager 舊金鑰及資料庫備份，以便資料回復；不可直接切回要求 MFA 欄位的舊版程式。

prod 尚未變更。若要發布 prod，需建立適用 prod 網域的 v2 key 與 secret，並先驗收測試環境。
