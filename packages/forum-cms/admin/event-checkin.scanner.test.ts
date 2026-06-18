import assert from 'assert'
import fs from 'fs'
import path from 'path'
import test from 'node:test'

test('event check-in scanner falls back when BarcodeDetector is unavailable', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'pages/event-checkin.tsx'),
    'utf8'
  )

  assert.match(source, /from 'jsqr'/)
  assert.match(source, /createQrCodeDetector/)
  assert.match(source, /detectWithCanvas/)
  assert.doesNotMatch(
    source,
    /if \(!BarcodeDetector\) \{\s*setCameraError\('此瀏覽器不支援 QR Code 掃描，請改用手動輸入。'\)\s*return\s*\}/
  )
})

test('event check-in page keeps result details inside mobile viewport', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'pages/event-checkin.tsx'),
    'utf8'
  )

  assert.match(source, /className="event-checkin-page"/)
  assert.match(source, /className="token-input-row"/)
  assert.match(source, /className="check-in-card"/)
  assert.match(source, /className="check-in-details"/)
  assert.match(source, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/)
  assert.match(source, /\.check-in-details dd[\s\S]+overflow-wrap:\s*anywhere/)
  assert.match(source, /@media\s*\(max-width:\s*640px\)/)
  assert.match(source, /\.check-in-details\s*\{[\s\S]+grid-template-columns:\s*1fr/)
})
