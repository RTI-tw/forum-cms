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
