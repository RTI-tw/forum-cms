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

test('event keeps activity fields and relates content through post', () => {
  const eventFields = (Event as any).fields
  const photoFields = (Photo as any).fields

  assert.ok(eventFields.post, 'Event should expose related Post')
  assert.ok(eventFields.externalLink, 'Event should expose externalLink')
  assert.ok(eventFields.startAt, 'Event should expose startAt')
  assert.ok(eventFields.endAt, 'Event should expose endAt')
  assert.equal(eventFields.title, undefined, 'Event should not expose title')
  assert.equal(eventFields.content, undefined, 'Event should not expose content')
  assert.equal(eventFields.images, undefined, 'Event should not expose images')
  assert.equal(eventFields.status, undefined, 'Event should not expose status')
  assert.equal(eventFields.isBoost, undefined, 'Event should not expose isBoost')
  assert.equal(
    eventFields.editorChoices,
    undefined,
    'Event should not expose direct editor choices'
  )
  assert.equal(photoFields.events, undefined, 'Photo should not expose events')
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

test('event prisma model stores event metadata and references post content', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.prisma'),
    'utf8'
  )
  const postModel = schema.match(/model Post \{[\s\S]+?\n\}/)?.[0]
  const eventModel = schema.match(/model Event \{[\s\S]+?\n\}/)?.[0]
  const photoModel = schema.match(/model Photo \{[\s\S]+?\n\}/)?.[0]

  assert.ok(postModel)
  assert.ok(eventModel)
  assert.ok(photoModel)
  assert.match(postModel, /events\s+Event\[\]\s+@relation\("Event_post"\)/)
  assert.match(eventModel, /post\s+Post\?\s+@relation\("Event_post"/)
  assert.match(eventModel, /postId\s+Int\?\s+@map\("post"\)/)
  assert.match(eventModel, /externalLink\s+String\s+@default\(""\)/)
  assert.doesNotMatch(eventModel, /\btitle\b/)
  assert.doesNotMatch(eventModel, /\bcontent\b/)
  assert.doesNotMatch(eventModel, /\bimages\b/)
  assert.doesNotMatch(eventModel, /\bstatus\b/)
  assert.doesNotMatch(eventModel, /\bisBoost\b/)
  assert.doesNotMatch(photoModel, /events\s+Event\[\]\s+@relation\("Event_images"\)/)
})

test('event check-in custom GraphQL operations are registered', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '../schema.graphql'),
    'utf8'
  )
  const resolverSource = fs.readFileSync(
    path.join(__dirname, '../utils/event-registration-gql.ts'),
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

  assert.match(
    resolverSource,
    /event\.post\?\.status !== 'published'/,
    'event public operations should use the related Post publication status'
  )
  assert.match(
    resolverSource,
    /heroImages:\s*\{\s*orderBy:\s*\{\s*sortOrder:\s*'asc'\s*\}/,
    'event public operations should expose related Post heroImages'
  )
  assert.doesNotMatch(
    resolverSource,
    /event\.status\s*={2,3}\s*'published'/,
    'event public operations should not use removed Event.status'
  )
  assert.doesNotMatch(
    resolverSource,
    /event\.images/,
    'event public operations should not use removed Event.images'
  )
})
