import assert from 'assert'
import fs from 'fs'
import path from 'path'
import test from 'node:test'
import { listDefinition } from './index'
import Member from './member'
import Event from './event'
import Photo from './image'

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

test('event exposes article-like content fields', () => {
  const eventFields = (Event as any).fields
  const photoFields = (Photo as any).fields

  assert.ok(eventFields.title, 'Event should expose title')
  assert.ok(eventFields.content, 'Event should expose content')
  assert.ok(eventFields.images, 'Event should expose images')
  assert.ok(eventFields.externalLink, 'Event should expose externalLink')
  assert.ok(eventFields.startAt, 'Event should expose startAt')
  assert.ok(eventFields.endAt, 'Event should expose endAt')
  assert.ok(eventFields.status, 'Event should expose status')
  assert.equal(
    eventFields.description,
    undefined,
    'Event should use content instead of description'
  )
  assert.ok(photoFields.events, 'Photo should expose related events')
})

test('event content uses markdown editor admin view', () => {
  const source = fs.readFileSync(path.join(__dirname, 'event.ts'), 'utf8')
  assert.match(source, /content:\s*text\(/)
  assert.match(source, /views:\s*['"]\.\/lists\/views\/markdown-editor\/index['"]/)
})

test('event external link uses shared safe URL validation', () => {
  const source = fs.readFileSync(path.join(__dirname, 'event.ts'), 'utf8')
  assert.match(source, /isSafeLinkUrl/)
  assert.match(source, /resolvedData\.externalLink/)
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

test('event prisma model stores content, images, and external link', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.prisma'),
    'utf8'
  )
  const eventModel = schema.match(/model Event \{[\s\S]+?\n\}/)?.[0]
  const photoModel = schema.match(/model Photo \{[\s\S]+?\n\}/)?.[0]

  assert.ok(eventModel)
  assert.ok(photoModel)
  assert.match(eventModel, /content\s+String\s+@default\(""\)/)
  assert.match(eventModel, /externalLink\s+String\s+@default\(""\)/)
  assert.match(eventModel, /images\s+Photo\[\]\s+@relation\("Event_images"\)/)
  assert.doesNotMatch(eventModel, /description/)
  assert.match(photoModel, /events\s+Event\[\]\s+@relation\("Event_images"\)/)
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

  const eventResult = schema.match(/type EventRegistrationEventResult \{[^}]+\}/)?.[0]
  assert.ok(eventResult)
  assert.match(eventResult, /content: String/)
  assert.match(eventResult, /externalLink: String/)
  assert.match(eventResult, /images: \[EventRegistrationEventImageResult!\]!/)
  assert.doesNotMatch(eventResult, /description/)

  const imageResult = schema.match(/type EventRegistrationEventImageResult \{[^}]+\}/)?.[0]
  assert.ok(imageResult)
  assert.match(imageResult, /id: ID!/)
  assert.match(imageResult, /urlOriginal: String/)
})
