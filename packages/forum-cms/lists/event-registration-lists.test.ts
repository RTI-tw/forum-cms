import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { listDefinition } from './index'
import Member from './member'

declare const test: (name: string, fn: () => void) => void

test('event lists are registered', () => {
  assert.ok(
    Object.prototype.hasOwnProperty.call(listDefinition, 'Event'),
    'Event list should be registered'
  )
  assert.ok(
    Object.prototype.hasOwnProperty.call(listDefinition, 'EventRegistration'),
    'EventRegistration list should be registered'
  )
})

test('member exposes event registrations relationship', () => {
  const fields = (Member as any).fields
  assert.ok(fields.eventRegistrations, 'Member should expose eventRegistrations')
})

test('event registration prisma model enforces duplicate prevention constraints', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.prisma'),
    'utf8'
  )
  assert.match(schema, /@@unique\(\[eventId, memberId\]\)/)
  assert.match(schema, /@@unique\(\[eventId, identityHash\]\)/)
  assert.match(schema, /@@index\(\[eventId, status\]\)/)
  assert.doesNotMatch(schema, /lastQrTokenExpiresAt/)
})

test('event check-in custom GraphQL operations are registered', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.graphql'),
    'utf8'
  )
  assert.match(schema, /issueEventCheckInQrToken\(/)
  assert.match(schema, /previewEventCheckInToken\(/)
  assert.match(schema, /confirmEventCheckIn\(/)
  assert.match(schema, /eventBySlug\(/)
  assert.match(schema, /myEventRegistrations/)
  assert.match(schema, /registerForEvent\(/)
  const tokenResult = schema.match(/type EventCheckInQrTokenResult \{[^}]+\}/)?.[0]
  assert.ok(tokenResult)
  assert.doesNotMatch(tokenResult, /expiresAt/)
})
