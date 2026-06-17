import assert from 'assert'
import fs from 'fs'
import path from 'path'
import test from 'node:test'

const source = fs.readFileSync(path.join(__dirname, 'ad.ts'), 'utf8')

test('ad format fields use live format-aware Admin UI views', () => {
  assert.match(source, /formatAwareRelationshipView/)
  assert.match(source, /formatAwareTextView/)
  assert.match(source, /formatAwareFileView/)

  for (const fieldName of ['image', 'slides']) {
    const fieldConfig = source.match(
      new RegExp(`${fieldName}:\\s+relationship\\(\\{[\\s\\S]+?\\n    \\}\\),`)
    )?.[0]
    assert.ok(fieldConfig, `${fieldName} field should exist`)
    assert.match(fieldConfig, /views:\s*formatAwareRelationshipView/)
  }

  for (const fieldName of ['videoUrl', 'adCode']) {
    const fieldConfig = source.match(
      new RegExp(`${fieldName}:\\s+text\\(\\{[\\s\\S]+?\\n    \\}\\),`)
    )?.[0]
    assert.ok(fieldConfig, `${fieldName} field should exist`)
    assert.match(fieldConfig, /views:\s*formatAwareTextView/)
  }

  const videoFileConfig = source.match(
    /videoFile:\s+file\(\{[\s\S]+?\n    \}\),/
  )?.[0]
  assert.ok(videoFileConfig, 'videoFile field should exist')
  assert.match(videoFileConfig, /views:\s*formatAwareFileView/)
})

test('ad format fields are not hidden by persisted item format metadata', () => {
  assert.doesNotMatch(source, /visibleForFormat/)
})
