const assert = require('assert')
const fs = require('fs')
const path = require('path')

const postSource = fs.readFileSync(path.join(__dirname, 'Post.ts'), 'utf8')
const pollFieldStart = postSource.indexOf('poll: relationship({')
assert.notStrictEqual(pollFieldStart, -1, 'Post.poll field should exist')

const nextFieldStart = postSource.indexOf('comments: relationship({', pollFieldStart)
assert.notStrictEqual(
  nextFieldStart,
  -1,
  'test could not find next Post field boundary'
)

const pollFieldSource = postSource.slice(pollFieldStart, nextFieldStart)

assert.match(
  pollFieldSource,
  /many:\s*true/,
  'Post.poll should allow multiple polls on one post'
)

const prismaSchema = fs.readFileSync(
  path.join(__dirname, '../schema.prisma'),
  'utf8'
)
const postModel = prismaSchema.match(/model Post \{[\s\S]+?\n\}/)?.[0]
const pollModel = prismaSchema.match(/model Poll \{[\s\S]+?\n\}/)?.[0]

assert.ok(postModel, 'Post prisma model should exist')
assert.ok(pollModel, 'Poll prisma model should exist')
assert.match(
  postModel,
  /poll\s+Poll\[\]\s+@relation\("Poll_post"\)/,
  'Post.poll should be generated as Poll[]'
)
assert.match(
  pollModel,
  /postId\s+Int\?\s+@map\("post"\)/,
  'Poll.postId should not be unique when one post can have many polls'
)
assert.doesNotMatch(
  pollModel,
  /postId\s+Int\?\s+@unique/,
  'Poll.postId must not declare a unique index'
)
assert.match(
  pollModel,
  /@@index\(\[postId\]\)/,
  'Poll.postId should keep a non-unique lookup index'
)

const graphqlSchema = fs.readFileSync(
  path.join(__dirname, '../schema.graphql'),
  'utf8'
)
const postType = graphqlSchema.match(/type Post \{[\s\S]+?\n\}/)?.[0]
const postUpdateInput = graphqlSchema.match(
  /input PostUpdateInput \{[\s\S]+?\n\}/
)?.[0]
const postCreateInput = graphqlSchema.match(
  /input PostCreateInput \{[\s\S]+?\n\}/
)?.[0]

assert.ok(postType, 'Post GraphQL type should exist')
assert.ok(postUpdateInput, 'PostUpdateInput should exist')
assert.ok(postCreateInput, 'PostCreateInput should exist')
assert.match(
  postType,
  /\n  poll\(where: PollWhereInput! = \{\}, orderBy: \[PollOrderByInput!\]! = \[\], take: Int, skip: Int! = 0, cursor: PollWhereUniqueInput\): \[Poll!\]\n/,
  'Post.poll should expose many Poll records'
)
assert.match(
  postType,
  /\n  pollCount\(where: PollWhereInput! = \{\}\): Int\n/,
  'Post.poll should expose pollCount'
)
assert.match(
  postUpdateInput,
  /\n  poll: PollRelateToManyForUpdateInput\n/,
  'Post updates should accept a to-many poll relation'
)
assert.match(
  postCreateInput,
  /\n  poll: PollRelateToManyForCreateInput\n/,
  'Post creates should accept a to-many poll relation'
)

const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../migrations/20260610031000_allow_multiple_polls_per_post/migration.sql'
  ),
  'utf8'
)
assert.match(
  migration,
  /DROP INDEX IF EXISTS "Poll_post_key"/,
  'migration should drop the old unique Poll.post index'
)
assert.match(
  migration,
  /CREATE INDEX IF NOT EXISTS "Poll_post_idx" ON "Poll"\("post"\)/,
  'migration should add a non-unique Poll.post index'
)
