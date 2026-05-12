const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(path.join(__dirname, 'Post.ts'), 'utf8')
const fieldStart = source.indexOf('displayPendingWarning: virtual({')
assert.notEqual(fieldStart, -1, 'displayPendingWarning field should exist')

const nextFieldStart = source.indexOf('isEditorChoice: checkbox({', fieldStart)
assert.notEqual(nextFieldStart, -1, 'test could not find next Post field boundary')

const fieldSource = source.slice(fieldStart, nextFieldStart)

assert.match(
  fieldSource,
  /itemView:\s*\{\s*fieldMode:\s*'hidden'\s*\}/,
  'displayPendingWarning should be hidden on the item view'
)
assert.match(
  fieldSource,
  /listView:\s*\{\s*fieldMode:\s*'hidden'\s*\}/,
  'displayPendingWarning should be hidden on the list view'
)
