const assert = require('assert')
const fs = require('fs')
const path = require('path')

function sourceFor(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
}

function filterQueryBlock(source) {
  const markerIndex = source.indexOf('query: ({ context }) => {')
  assert.notStrictEqual(markerIndex, -1, 'missing query filter block')
  const nextSectionIndex = source.indexOf('\n    },', markerIndex)
  assert.notStrictEqual(nextSectionIndex, -1, 'missing query filter end')
  return source.slice(markerIndex, nextSectionIndex)
}

const postVisibilitySource = sourceFor('../utils/post-visibility.ts')
const accessControlSource = sourceFor('../utils/access-control.ts')
const memberSource = sourceFor('member.ts')

assert.match(
  postVisibilitySource,
  /export function canReadTrustedBackendContent/,
  'post visibility utilities should expose one shared trusted backend content-read helper'
)
assert.match(
  postVisibilitySource,
  /export function canReadAllPostStatuses[\s\S]+?canReadTrustedBackendContent\(context\)/,
  'Post all-status reads should use the same trusted backend content-read rule'
)

for (const fileName of ['comment.ts', 'poll.ts', 'poll-option.ts']) {
  const source = sourceFor(fileName)
  assert.match(
    source,
    /canReadTrustedBackendContent/,
    `${fileName} should import the trusted backend content-read helper`
  )

  const block = filterQueryBlock(source)
  assert.match(
    block,
    /if \(canReadTrustedBackendContent\(context\)\) return true/,
    `${fileName} should let trusted backend API reads reach translation source fields`
  )
  assert.ok(
    block.indexOf('canReadTrustedBackendContent(context)') <
      block.indexOf('getAuthenticatedMemberId(context)'),
    `${fileName} should bypass public/member visibility before deriving frontend member identity`
  )
}

assert.doesNotMatch(
  accessControlSource,
  /canReadTrustedBackendContent/,
  'trusted backend content reads must not globally bypass per-list API access rules'
)
assert.match(
  accessControlSource,
  /isApiAccessAllowed\(listKey, operation\)/,
  'api strategy should continue to enforce per-list read/write rules for sensitive lists'
)
assert.doesNotMatch(
  memberSource,
  /canReadTrustedBackendContent/,
  'sensitive Member data should not use the translation trusted backend content-read helper'
)
