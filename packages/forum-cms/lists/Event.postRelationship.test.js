const assert = require('assert')
const fs = require('fs')
const path = require('path')

const listsDir = __dirname
const cmsDir = path.join(listsDir, '..')

const postSource = fs.readFileSync(path.join(listsDir, 'Post.ts'), 'utf8')
const eventSource = fs.readFileSync(path.join(listsDir, 'event.ts'), 'utf8')
const imageSource = fs.readFileSync(path.join(listsDir, 'image.ts'), 'utf8')
const editorChoiceSource = fs.readFileSync(
  path.join(listsDir, 'editor-choice.ts'),
  'utf8'
)
const syncSource = fs.readFileSync(
  path.join(cmsDir, 'utils/sync-editor-choice-state.ts'),
  'utf8'
)

const eventPostFieldStart = eventSource.indexOf('post: relationship({')
assert.notStrictEqual(
  eventPostFieldStart,
  -1,
  'Event should expose a post relationship'
)
const externalLinkStart = eventSource.indexOf(
  'externalLink: text({',
  eventPostFieldStart
)
assert.notStrictEqual(
  externalLinkStart,
  -1,
  'test could not find next Event field boundary'
)
const eventPostFieldSource = eventSource.slice(
  eventPostFieldStart,
  externalLinkStart
)
assert.match(eventPostFieldSource, /ref:\s*'Post\.events'/)
assert.match(eventPostFieldSource, /many:\s*false/)

assert.match(
  postSource,
  /events:\s*relationship\(\{\s*ref:\s*'Event\.post',\s*many:\s*true/s,
  'Post should expose related events as a to-many relationship'
)

for (const removedField of [
  'title',
  'content',
  'images',
  'status',
  'isBoost',
  'editorChoices',
]) {
  assert.doesNotMatch(
    eventSource,
    new RegExp(`\\b${removedField}:\\s*(?:text|relationship|select|checkbox)\\(`),
    `Event should not keep content field ${removedField}`
  )
}
assert.match(eventSource, /labelField:\s*'slug'/)
assert.doesNotMatch(
  imageSource,
  /events:\s*relationship\(\{\s*ref:\s*'Event\.images'/,
  'Photo should no longer relate directly to Event images'
)

assert.doesNotMatch(
  editorChoiceSource,
  /event:\s*relationship\(/,
  'EditorChoice should not expose a direct event relationship'
)
assert.doesNotMatch(
  editorChoiceSource,
  /eventId/,
  'EditorChoice should not keep eventId handling'
)
assert.doesNotMatch(
  syncSource,
  /syncEditorChoiceStateForEventId/,
  'EditorChoice sync should only depend on Post status'
)

const prismaSchema = fs.readFileSync(path.join(cmsDir, 'schema.prisma'), 'utf8')
const postModel = prismaSchema.match(/model Post \{[\s\S]+?\n\}/)?.[0]
const eventModel = prismaSchema.match(/model Event \{[\s\S]+?\n\}/)?.[0]
const editorChoiceModel = prismaSchema.match(
  /model EditorChoice \{[\s\S]+?\n\}/
)?.[0]
const photoModel = prismaSchema.match(/model Photo \{[\s\S]+?\n\}/)?.[0]

assert.ok(postModel, 'Post prisma model should exist')
assert.ok(eventModel, 'Event prisma model should exist')
assert.ok(editorChoiceModel, 'EditorChoice prisma model should exist')
assert.ok(photoModel, 'Photo prisma model should exist')
assert.match(
  postModel,
  /events\s+Event\[\]\s+@relation\("Event_post"\)/,
  'Post should store the reverse Event relation'
)
assert.match(
  eventModel,
  /post\s+Post\?\s+@relation\("Event_post", fields: \[postId\], references: \[id\]\)/,
  'Event should relate to one Post'
)
assert.match(
  eventModel,
  /postId\s+Int\?\s+@map\("post"\)/,
  'Event should store the post foreign key in column "post"'
)
assert.match(eventModel, /@@index\(\[postId\]\)/)
for (const removedColumn of [
  'title',
  'content',
  'images',
  'status',
  'isBoost',
  'editorChoices',
]) {
  assert.doesNotMatch(
    eventModel,
    new RegExp(`\\b${removedColumn}\\b`),
    `Event prisma model should not keep ${removedColumn}`
  )
}
assert.doesNotMatch(editorChoiceModel, /\bevent\b/)
assert.doesNotMatch(editorChoiceModel, /eventId/)
assert.doesNotMatch(photoModel, /events\s+Event\[\]\s+@relation\("Event_images"\)/)

const graphqlSchema = fs.readFileSync(path.join(cmsDir, 'schema.graphql'), 'utf8')
const postType = graphqlSchema.match(/type Post \{[\s\S]+?\n\}/)?.[0]
const postUpdateInput = graphqlSchema.match(
  /input PostUpdateInput \{[\s\S]+?\n\}/
)?.[0]
const postCreateInput = graphqlSchema.match(
  /input PostCreateInput \{[\s\S]+?\n\}/
)?.[0]
const eventType = graphqlSchema.match(/type Event \{[\s\S]+?\n\}/)?.[0]
const eventWhereInput = graphqlSchema.match(/input EventWhereInput \{[\s\S]+?\n\}/)?.[0]
const eventUpdateInput = graphqlSchema.match(
  /input EventUpdateInput \{[\s\S]+?\n\}/
)?.[0]
const eventCreateInput = graphqlSchema.match(
  /input EventCreateInput \{[\s\S]+?\n\}/
)?.[0]
const editorChoiceType = graphqlSchema.match(/type EditorChoice \{[\s\S]+?\n\}/)?.[0]
const editorChoiceWhereInput = graphqlSchema.match(
  /input EditorChoiceWhereInput \{[\s\S]+?\n\}/
)?.[0]

assert.ok(postType, 'Post GraphQL type should exist')
assert.ok(postUpdateInput, 'PostUpdateInput should exist')
assert.ok(postCreateInput, 'PostCreateInput should exist')
assert.ok(eventType, 'Event GraphQL type should exist')
assert.ok(eventWhereInput, 'EventWhereInput should exist')
assert.ok(eventUpdateInput, 'EventUpdateInput should exist')
assert.ok(eventCreateInput, 'EventCreateInput should exist')
assert.ok(editorChoiceType, 'EditorChoice GraphQL type should exist')
assert.ok(editorChoiceWhereInput, 'EditorChoiceWhereInput should exist')
assert.match(postType, /\n  events\(where: EventWhereInput! = \{\}/)
assert.match(postType, /\n  eventsCount\(where: EventWhereInput! = \{\}\): Int\n/)
assert.match(postUpdateInput, /\n  events: EventRelateToManyForUpdateInput\n/)
assert.match(postCreateInput, /\n  events: EventRelateToManyForCreateInput\n/)
assert.match(eventType, /\n  post: Post\n/)
assert.match(eventWhereInput, /\n  post: PostWhereInput\n/)
assert.match(eventUpdateInput, /\n  post: PostRelateToOneForUpdateInput\n/)
assert.match(eventCreateInput, /\n  post: PostRelateToOneForCreateInput\n/)
for (const removedGraphqlField of [
  'title',
  'content',
  'images',
  'status',
  'isBoost',
  'editorChoices',
  'event: Event',
]) {
  assert.doesNotMatch(eventType, new RegExp(`\\n  ${removedGraphqlField}`))
  assert.doesNotMatch(eventWhereInput, new RegExp(`\\n  ${removedGraphqlField}`))
  assert.doesNotMatch(eventUpdateInput, new RegExp(`\\n  ${removedGraphqlField}`))
  assert.doesNotMatch(eventCreateInput, new RegExp(`\\n  ${removedGraphqlField}`))
}
assert.doesNotMatch(editorChoiceType, /\n  event: Event\n/)
assert.doesNotMatch(editorChoiceWhereInput, /\n  event: EventWhereInput\n/)

const migration = fs.readFileSync(
  path.join(
    cmsDir,
    'migrations/20260610040000_event_post_content_refactor/migration.sql'
  ),
  'utf8'
)
assert.match(migration, /ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "post" INTEGER/)
assert.match(migration, /INSERT INTO "Post"/)
assert.match(migration, /"_Event_images"/)
assert.match(migration, /"_Photo_postsAsHeroImages"/)
assert.match(migration, /ALTER TABLE "Event" DROP COLUMN IF EXISTS "title"/)
assert.match(migration, /ALTER TABLE "EditorChoice" DROP COLUMN IF EXISTS "event"/)
