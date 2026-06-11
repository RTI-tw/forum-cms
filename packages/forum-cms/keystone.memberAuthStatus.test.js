const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(path.join(__dirname, 'keystone.ts'), 'utf8')
const resolverIndex = source.indexOf('authenticatedMember: graphql.field')
assert.notStrictEqual(resolverIndex, -1, 'authenticatedMember resolver is missing')

const mutationIndex = source.indexOf('authenticateMemberWithFirebase:', resolverIndex)
assert.notStrictEqual(mutationIndex, -1, 'authenticateMemberWithFirebase resolver is missing')

const resolverSource = source.slice(resolverIndex, mutationIndex)

assert.match(
  resolverSource,
  /isMemberRegistrationBlocked\(member\.status\)/,
  'authenticatedMember should block only unavailable member statuses'
)
assert.doesNotMatch(
  resolverSource,
  /member\.status\s*!==\s*["']active["']/,
  'authenticatedMember should allow inactive members to finish profile setup'
)
