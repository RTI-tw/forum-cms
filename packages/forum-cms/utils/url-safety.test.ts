import assert from 'assert'
import { isSafeLinkUrl } from './url-safety'

function testAllowsSafeValues() {
  // 空字串視為未填
  assert.equal(isSafeLinkUrl(''), true)
  assert.equal(isSafeLinkUrl('   '), true)
  // http/https 絕對網址
  assert.equal(isSafeLinkUrl('https://example.com/path?q=1'), true)
  assert.equal(isSafeLinkUrl('http://example.com'), true)
  // 站內相對路徑
  assert.equal(isSafeLinkUrl('/news/123'), true)
  assert.equal(isSafeLinkUrl('  /news/123  '), true)
}

function testRejectsDangerousSchemes() {
  assert.equal(isSafeLinkUrl('javascript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('JavaScript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('java\nscript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('  javascript:alert(1)'), false)
  assert.equal(isSafeLinkUrl('data:text/html,<script>alert(1)</script>'), false)
  assert.equal(isSafeLinkUrl('vbscript:msgbox(1)'), false)
  // 非 http/https 的其他 scheme
  assert.equal(isSafeLinkUrl('ftp://example.com'), false)
}

function testRejectsOpenRedirectForms() {
  // protocol-relative
  assert.equal(isSafeLinkUrl('//evil.com'), false)
  // 反斜線形式（部分瀏覽器正規化為 //evil.com）
  assert.equal(isSafeLinkUrl('/\\evil.com'), false)
  assert.equal(isSafeLinkUrl('/\\/evil.com'), false)
}

function main() {
  testAllowsSafeValues()
  testRejectsDangerousSchemes()
  testRejectsOpenRedirectForms()
  // eslint-disable-next-line no-console
  console.log('url-safety.test.ts: all assertions passed')
}

main()
