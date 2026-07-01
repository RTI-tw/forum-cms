const assert = require('assert')
const fs = require('fs')
const path = require('path')

const pollSource = fs.readFileSync(path.join(__dirname, 'poll.ts'), 'utf8')
const pollOptionsSortedViewPath = path.join(
  __dirname,
  'views/poll-options-sorted-relationship/index.tsx'
)
const sortedRelationshipUseItemStateSource = fs.readFileSync(
  path.join(__dirname, 'views/sorted-relationship/cards/useItemState.tsx'),
  'utf8'
)
const sortedRelationshipCardsSource = fs.readFileSync(
  path.join(__dirname, 'views/sorted-relationship/cards/index.tsx'),
  'utf8'
)
const cmsModerationSource = fs.readFileSync(
  path.join(__dirname, '../utils/cms-content-moderation.ts'),
  'utf8'
)

function relationshipFieldSource(source, fieldName) {
  return source.match(
    new RegExp(`${fieldName}:\\s+relationship\\(\\{[\\s\\S]+?\\n    \\}\\),`)
  )?.[0]
}

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

const pollOptionsField = relationshipFieldSource(pollSource, 'options')

assert.ok(pollOptionsField, 'Poll.options field should exist')
assert.match(
  pollOptionsField,
  /views:\s*'\.\/lists\/views\/poll-options-sorted-relationship\/index'/,
  'Poll.options should use the sorted PollOption relationship view'
)
assert.ok(
  fs.existsSync(pollOptionsSortedViewPath),
  'Poll.options sorted relationship view should exist'
)

const pollOptionsSortedViewSource = fs.readFileSync(
  pollOptionsSortedViewPath,
  'utf8'
)

assert.match(
  pollOptionsSortedViewSource,
  /POLL_OPTION_RELATIONSHIP_ORDER_BY\s*=\s*'\[\{ sortOrder: asc \}, \{ id: asc \}\]'/,
  'Poll.options sorted relationship view should sort by sortOrder then id'
)
assert.match(
  pollOptionsSortedViewSource,
  /relationshipOrderBy=\{POLL_OPTION_RELATIONSHIP_ORDER_BY\}/,
  'Poll.options sorted relationship view should pass orderBy into the cards renderer'
)
assert.match(
  pollOptionsSortedViewSource,
  /relationshipSortField="sortOrder"/,
  'Poll.options sorted relationship view should tell the cards renderer to display by sortOrder'
)
assert.match(
  sortedRelationshipUseItemStateSource,
  /relationshipQueryArgs\s*=\s*relationshipOrderBy\s*\?\s*`\s*\(orderBy: \$\{relationshipOrderBy\}\)\s*`\s*:\s*''/,
  'Sorted relationship cards should build GraphQL relationship orderBy args'
)
assert.match(
  sortedRelationshipUseItemStateSource,
  /relationship:\s*\$\{field\.path\}\$\{relationshipQueryArgs\}/,
  'Sorted relationship cards should apply relationship orderBy args to the item-view query'
)
assert.match(
  sortedRelationshipCardsSource,
  /relationshipSortField\?:\s*string/,
  'Sorted relationship cards should accept a display sort field'
)
assert.match(
  sortedRelationshipCardsSource,
  /currentIdsArrayWithFetchedItems\.sort/,
  'Sorted relationship cards should sort rendered cards when a display sort field is provided'
)
