const assert = require('assert')
const fs = require('fs')
const path = require('path')

const pollSource = fs.readFileSync(path.join(__dirname, 'poll.ts'), 'utf8')
const cmsModerationSource = fs.readFileSync(
  path.join(__dirname, '../utils/cms-content-moderation.ts'),
  'utf8'
)

const pollUpdateWhitelist = cmsModerationSource.match(
  /const POLL_UPDATE_TRANSLATION_ONLY = new Set\(\[[\s\S]+?\]\)/
)?.[0]

assert.ok(pollUpdateWhitelist, 'Poll update whitelist should exist')
assert.match(
  pollUpdateWhitelist,
  /'expiresAt'/,
  'Poll update whitelist should allow changing expiresAt'
)
assert.doesNotMatch(
  pollUpdateWhitelist,
  /'title'(?:,|\s|\])/,
  'Poll update whitelist should keep original title locked'
)
assert.doesNotMatch(
  pollUpdateWhitelist,
  /'totalVotes'/,
  'Poll update whitelist should keep vote counts locked'
)
assert.doesNotMatch(
  pollUpdateWhitelist,
  /'options'/,
  'Poll update whitelist should keep poll options locked'
)

const pollListView = pollSource.match(
  /listView:\s*\{\s*initialColumns:\s*\[[^\]]+\]/
)?.[0]

assert.ok(pollListView, 'Poll list view initialColumns should exist')
assert.match(
  pollListView,
  /'createdAt'/,
  'Poll list view should show createdAt'
)
