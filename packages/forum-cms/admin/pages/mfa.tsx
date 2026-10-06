import { FormEvent, useEffect, useState } from 'react'
import Head from 'next/head'

export default function MfaPage() {
  const [setup, setSetup] = useState<{ enrollment: boolean; secret?: string; email: string; qrCodeDataUrl?: string } | null>(null)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [redirect, setRedirect] = useState('/')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    fetch('/api/cms-mfa', { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        if (data.authenticated) { window.location.replace('/'); return }
        setSetup(data)
      }).catch(error => setMessage(error.message || '無法載入驗證設定'))
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/cms-mfa', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CMS-MFA': '1' },
        body: JSON.stringify({ code, useRecovery }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      if (data.recoveryCodes?.length) {
        setRecoveryCodes(data.recoveryCodes); setRedirect(data.redirect); setCode('')
      } else window.location.replace(data.redirect)
    } catch (error) { setMessage(error instanceof Error ? error.message : '驗證失敗，請稍後再試') }
    finally { setBusy(false) }
  }
  return <>
    <Head><title>兩步驟驗證｜CMS</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 480, background: 'white', padding: 32, borderRadius: 12, boxShadow: '0 4px 24px #0001', overflowWrap: 'anywhere' }}>
        <h1>{recoveryCodes.length ? '請保存復原碼' : setup?.enrollment ? '設定兩步驟驗證' : '兩步驟驗證'}</h1>
        {message && <p role="alert" style={{ color: '#b42318' }}>{message}</p>}
        {recoveryCodes.length ? <>
          <p>驗證器已綁定。每組復原碼只能使用一次，可在手機遺失時配合密碼登入。復原碼僅顯示這一次，請存放於安全的位置。</p>
          <pre style={{ background: '#f5f7fa', padding: 16, lineHeight: 1.7 }}>{recoveryCodes.join('\n')}</pre>
          <button type="button" onClick={() => {
            const url = URL.createObjectURL(new Blob(['CMS 復原碼\n' + recoveryCodes.join('\n')], { type: 'text/plain;charset=utf-8' }))
            const link = document.createElement('a'); link.href = url; link.download = 'cms-recovery-codes.txt'; link.click(); URL.revokeObjectURL(url)
          }}>下載復原碼</button>
          <p><label><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> 我已安全保存復原碼</label></p>
          <button type="button" disabled={!saved} onClick={() => window.location.replace(redirect)}>繼續進入後台</button>
        </> : setup ? <form onSubmit={submit}>
          {setup.enrollment ? <>
            <p>開啟 Google Authenticator 或 Microsoft Authenticator，新增帳戶並選擇掃描 QR Code。</p>
            {setup.qrCodeDataUrl ? <img src={setup.qrCodeDataUrl} alt="用驗證器 App 掃描此 QR Code 以綁定 CMS 帳戶" width={300} height={300} style={{ display: 'block', width: '100%', maxWidth: 300, height: 'auto', margin: '0 auto' }} /> : <p>QR Code 無法載入，請使用下方設定金鑰手動新增帳戶。</p>}
            <details>
              <summary>無法掃描？手動輸入設定金鑰</summary>
              <p>帳戶：{setup.email}<br />類型：時間型（TOTP）</p>
              <p>設定金鑰：</p><code style={{ display: 'block', background: '#f5f7fa', padding: 12, userSelect: 'all' }}>{setup.secret}</code>
            </details>
            <p>加入後，輸入驗證器顯示的六位數驗證碼完成綁定。請勿分享 QR Code 或設定金鑰。</p>
          </> : <p>{useRecovery ? '輸入一組尚未使用的復原碼。' : '請輸入驗證器 App 目前顯示的六位數驗證碼。'}</p>}
          <div style={{ background: '#f0f4ff', padding: 20, borderRadius: 8, margin: '20px 0' }}>
            <label htmlFor="mfa-code" style={{ display: 'block', fontWeight: 700, color: '#172b4d' }}>{useRecovery ? '輸入復原碼' : '輸入六位數驗證碼'}</label>
            <p id="mfa-code-help" style={{ margin: '8px 0 12px', fontSize: 14, color: '#475569' }}>{useRecovery ? '請填入先前保存的一組復原碼。' : '打開手機上的驗證器 App，將目前顯示的六位數字填入下方欄位。'}</p>
            <input id="mfa-code" type="text" value={code} onChange={e => setCode(e.target.value)} placeholder={useRecovery ? '請輸入復原碼' : '請輸入 6 位數字'} aria-describedby="mfa-code-help" autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} pattern={useRecovery ? undefined : '[0-9]{6}'} maxLength={useRecovery ? 64 : 6} required style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 56, padding: 14, border: '2px solid #64748b', borderRadius: 8, background: '#fff', color: '#172b4d', fontSize: 22, letterSpacing: useRecovery ? 'normal' : '0.12em' }} />
          </div>
          <button type="submit" disabled={busy} style={{ display: 'block', width: '100%', padding: 14, border: 0, borderRadius: 8, background: '#1d4ed8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.65 : 1 }}>{busy ? '驗證中…' : setup.enrollment ? '確認綁定' : '驗證並登入'}</button>
          {!setup.enrollment && <p><button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(''); setMessage('') }}>{useRecovery ? '使用驗證器驗證碼' : '改用復原碼'}</button></p>}
        </form> : !message && <p>載入中…</p>}
        {!recoveryCodes.length && <p><a href="/signin">重新登入</a></p>}
      </section>
    </main>
  </>
}
