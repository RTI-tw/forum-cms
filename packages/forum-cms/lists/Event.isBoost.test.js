const assert = require('assert')
const fs = require('fs')
const path = require('path')

const cmsDir = path.join(__dirname, '..')
const eventSource = fs.readFileSync(path.join(__dirname, 'event.ts'), 'utf8')

assert.match(
  eventSource,
  /checkbox/,
  'Event list should import the checkbox field type'
)

const fieldStart = eventSource.indexOf('isBoost: checkbox({')
assert.notStrictEqual(fieldStart, -1, 'Event should expose isBoost field')

const nextFieldStart = eventSource.indexOf('startAt: timestamp({', fieldStart)
assert.notStrictEqual(
  nextFieldStart,
  -1,
  'test could not find next Event field boundary'
)

const fieldSource = eventSource.slice(fieldStart, nextFieldStart)
assert.match(fieldSource, /label:\s*'置頂'/)
assert.match(fieldSource, /defaultValue:\s*false/)

const prismaSchema = fs.readFileSync(path.join(cmsDir, 'schema.prisma'), 'utf8')
const eventModel = prismaSchema.match(/model Event \{[\s\S]+?\n\}/)?.[0]
assert.ok(eventModel, 'Event prisma model should exist')
assert.match(
  eventModel,
  /isBoost\s+Boolean\s+@default\(false\)/,
  'Event.isBoost should be a boolean with false default'
)

const graphqlSchema = fs.readFileSync(path.join(cmsDir, 'schema.graphql'), 'utf8')
const eventType = graphqlSchema.match(/type Event \{[\s\S]+?\n\}/)?.[0]
const eventUpdateInput = graphqlSchema.match(
  /input EventUpdateInput \{[\s\S]+?\n\}/
)?.[0]
const eventCreateInput = graphqlSchema.match(
  /input EventCreateInput \{[\s\S]+?\n\}/
)?.[0]
assert.ok(eventType, 'Event GraphQL type should exist')
assert.ok(eventUpdateInput, 'EventUpdateInput should exist')
assert.ok(eventCreateInput, 'EventCreateInput should exist')
assert.match(eventType, /\n  isBoost: Boolean\n/)
assert.match(eventUpdateInput, /\n  isBoost: Boolean\n/)
assert.match(eventCreateInput, /\n  isBoost: Boolean\n/)

const migration = fs.readFileSync(
  path.join(cmsDir, 'migrations/20260610034000_event_is_boost/migration.sql'),
  'utf8'
)
assert.match(
  migration,
  /ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isBoost" BOOLEAN NOT NULL DEFAULT false/,
  'migration should add Event.isBoost with a false default'
)
