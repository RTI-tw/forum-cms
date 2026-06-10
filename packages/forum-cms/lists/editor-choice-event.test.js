const assert = require('assert')
const fs = require('fs')
const path = require('path')

const listsDir = __dirname
const cmsDir = path.join(listsDir, '..')

const editorChoiceSource = fs.readFileSync(
  path.join(listsDir, 'editor-choice.ts'),
  'utf8'
)
const eventSource = fs.readFileSync(path.join(listsDir, 'event.ts'), 'utf8')
const syncSource = fs.readFileSync(
  path.join(cmsDir, 'utils/sync-editor-choice-state.ts'),
  'utf8'
)

const eventFieldStart = editorChoiceSource.indexOf('event: relationship({')
assert.notStrictEqual(
  eventFieldStart,
  -1,
  'EditorChoice should expose an event relationship'
)
const sortOrderStart = editorChoiceSource.indexOf(
  'sortOrder: integer({',
  eventFieldStart
)
assert.notStrictEqual(
  sortOrderStart,
  -1,
  'test could not find EditorChoice event field boundary'
)
const eventFieldSource = editorChoiceSource.slice(eventFieldStart, sortOrderStart)
assert.match(eventFieldSource, /ref:\s*'Event\.editorChoices'/)
assert.match(eventFieldSource, /many:\s*false/)

assert.match(
  editorChoiceSource,
  /請選擇文章或活動其中一種/,
  'EditorChoice should require exactly one target type'
)
assert.match(
  editorChoiceSource,
  /context\.prisma\.event\.findUnique/,
  'EditorChoice should derive state from selected event status'
)

assert.match(
  eventSource,
  /editorChoices:\s*relationship\(\{\s*ref:\s*'EditorChoice\.event',\s*many:\s*true/s,
  'Event should expose reverse editorChoices relationship'
)
assert.match(
  eventSource,
  /syncEditorChoiceStateForEventId/,
  'Event should resync EditorChoice state after event changes'
)

assert.match(
  syncSource,
  /export function editorChoiceStateFromContentStatus/,
  'shared state helper should work for Post and Event status values'
)
assert.match(
  syncSource,
  /export async function syncEditorChoiceStateForEventId/,
  'state sync utility should support Event'
)

const prismaSchema = fs.readFileSync(path.join(cmsDir, 'schema.prisma'), 'utf8')
const eventModel = prismaSchema.match(/model Event \{[\s\S]+?\n\}/)?.[0]
const editorChoiceModel = prismaSchema.match(
  /model EditorChoice \{[\s\S]+?\n\}/
)?.[0]
assert.ok(eventModel, 'Event prisma model should exist')
assert.ok(editorChoiceModel, 'EditorChoice prisma model should exist')
assert.match(
  eventModel,
  /editorChoices\s+EditorChoice\[\]\s+@relation\("EditorChoice_event"\)/,
  'Event should have many EditorChoice records'
)
assert.match(
  editorChoiceModel,
  /event\s+Event\?\s+@relation\("EditorChoice_event", fields: \[eventId\], references: \[id\]\)/,
  'EditorChoice should relate to Event'
)
assert.match(
  editorChoiceModel,
  /eventId\s+Int\?\s+@map\("event"\)/,
  'EditorChoice should store the event foreign key in column "event"'
)
assert.match(
  editorChoiceModel,
  /@@index\(\[eventId\]\)/,
  'EditorChoice.event should be indexed'
)

const graphqlSchema = fs.readFileSync(path.join(cmsDir, 'schema.graphql'), 'utf8')
const editorChoiceType = graphqlSchema.match(/type EditorChoice \{[\s\S]+?\n\}/)?.[0]
const editorChoiceWhereInput = graphqlSchema.match(
  /input EditorChoiceWhereInput \{[\s\S]+?\n\}/
)?.[0]
const editorChoiceUpdateInput = graphqlSchema.match(
  /input EditorChoiceUpdateInput \{[\s\S]+?\n\}/
)?.[0]
const editorChoiceCreateInput = graphqlSchema.match(
  /input EditorChoiceCreateInput \{[\s\S]+?\n\}/
)?.[0]
assert.ok(editorChoiceType, 'EditorChoice GraphQL type should exist')
assert.ok(editorChoiceWhereInput, 'EditorChoiceWhereInput should exist')
assert.ok(editorChoiceUpdateInput, 'EditorChoiceUpdateInput should exist')
assert.ok(editorChoiceCreateInput, 'EditorChoiceCreateInput should exist')
assert.match(editorChoiceType, /\n  event: Event\n/)
assert.match(editorChoiceWhereInput, /\n  event: EventWhereInput\n/)
assert.match(
  editorChoiceUpdateInput,
  /\n  event: EventRelateToOneForUpdateInput\n/
)
assert.match(
  editorChoiceCreateInput,
  /\n  event: EventRelateToOneForCreateInput\n/
)

const migration = fs.readFileSync(
  path.join(
    cmsDir,
    'migrations/20260610033000_editor_choice_event/migration.sql'
  ),
  'utf8'
)
assert.match(migration, /ALTER TABLE "EditorChoice" ADD COLUMN IF NOT EXISTS "event" INTEGER/)
assert.match(migration, /CREATE INDEX IF NOT EXISTS "EditorChoice_event_idx" ON "EditorChoice"\("event"\)/)
assert.match(migration, /ADD CONSTRAINT "EditorChoice_event_fkey"/)
