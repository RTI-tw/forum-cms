import assert from 'assert'
import test from 'node:test'
import fs from 'fs'
import path from 'path'
import { isRegistrationOpen } from './event-registration-gql'

test('event registration public API no longer collects personal identifiers', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'event-registration-gql.ts'),
    'utf8'
  )

  assert.doesNotMatch(source, /normalizeEventRegistrationForm/)
  assert.doesNotMatch(source, /\bidentityType\b/)
  assert.doesNotMatch(source, /\bidentityNumber\b/)
  assert.doesNotMatch(source, /\bphoneNumber\b/)
  assert.doesNotMatch(source, /\bidentityHash\b/)
  assert.doesNotMatch(source, /\bphoneHash\b/)
})

test('registration window treats missing bounds as open', () => {
  const now = new Date('2026-06-05T12:00:00.000Z')
  assert.equal(isRegistrationOpen({}, now), true)
  assert.equal(
    isRegistrationOpen({ registrationStartAt: '2026-06-05T13:00:00.000Z' }, now),
    false
  )
  assert.equal(
    isRegistrationOpen({ registrationEndAt: '2026-06-05T11:00:00.000Z' }, now),
    false
  )
})
