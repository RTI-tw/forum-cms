const assert = require('assert')
const fs = require('fs')
const path = require('path')

const memberSource = fs.readFileSync(path.join(__dirname, 'member.ts'), 'utf8')
const cronFilterStart = memberSource.indexOf(
  'if (!isCronServiceRequest(context))'
)
assert.notStrictEqual(
  cronFilterStart,
  -1,
  'Member query filter should distinguish cron-service reads'
)

const accessEnd = memberSource.indexOf('\n  hooks:', cronFilterStart)
assert.notStrictEqual(
  accessEnd,
  -1,
  'Member query filter test could not find the access block boundary'
)

const cronFilterSource = memberSource.slice(cronFilterStart, accessEnd)

assert.match(
  cronFilterSource,
  /status:\s*\{\s*equals:\s*'active'\s*\}/,
  'cron-service member reads should stay limited to active members'
)
assert.doesNotMatch(
  cronFilterSource,
  /isOfficial:\s*\{\s*equals:\s*true\s*\}/,
  'cron-service member reads must include regular active authors for public post exports'
)
