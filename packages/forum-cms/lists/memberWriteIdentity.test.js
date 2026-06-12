const assert = require('assert')
const fs = require('fs')
const path = require('path')

function sourceFor(fileName) {
  return fs.readFileSync(path.join(__dirname, fileName), 'utf8')
}

function nonCmsBlock(source, marker) {
  const markerIndex = source.indexOf(marker)
  assert.notStrictEqual(markerIndex, -1, `missing marker: ${marker}`)
  const elseIndex = source.indexOf('} else {', markerIndex)
  assert.notStrictEqual(elseIndex, -1, `missing CMS else for: ${marker}`)
  return source.slice(markerIndex, elseIndex)
}

const postSource = sourceFor('Post.ts')
const commentSource = sourceFor('comment.ts')
const bookmarkSource = sourceFor('bookmark.ts')
const pollVoteSource = sourceFor('poll-vote.ts')
const reportSource = sourceFor('report.ts')

const postNonCmsCreate = nonCmsBlock(postSource, '[AC-005]')
assert.match(
  postNonCmsCreate,
  /getAuthenticatedMemberId\(context\)/,
  'Post non-CMS create should bind author from the frontend bearer token'
)
assert.doesNotMatch(
  postNonCmsCreate,
  /getOfficialMemberIdForSessionUser/,
  'Post non-CMS create must not use CMS User -> Official Member mapping'
)
assert.match(
  postNonCmsCreate,
  /data\.status = 'pending'/,
  'Post non-CMS create should force posts into pending review'
)

const commentNonCmsCreate = nonCmsBlock(commentSource, '[AC-006]')
assert.match(
  commentNonCmsCreate,
  /getAuthenticatedMemberId\(context\)/,
  'Comment non-CMS create should bind member from the frontend bearer token'
)
assert.doesNotMatch(
  commentNonCmsCreate,
  /getOfficialMemberIdForSessionUser/,
  'Comment non-CMS create must not use CMS User -> Official Member mapping'
)

assert.match(
  bookmarkSource,
  /書籤操作需要有效的會員登入狀態/,
  'Bookmark writes should require a frontend member token'
)
assert.match(
  bookmarkSource,
  /data\.member = \{ connect: \{ id: memberId \} \}/,
  'Bookmark create should bind member from the frontend bearer token'
)
assert.match(
  bookmarkSource,
  /\[AC-007\][\s\S]+?update:[\s\S]+?delete:[\s\S]+?resolveInput/,
  'Bookmark update/delete/create should keep owner write isolation'
)

assert.match(
  pollVoteSource,
  /投票紀錄需要有效的會員登入狀態/,
  'PollVote writes should require a frontend member token'
)
assert.match(
  pollVoteSource,
  /投票不存在或不可參與/,
  'PollVote create should validate poll visibility'
)
assert.match(
  pollVoteSource,
  /選項不屬於此投票/,
  'PollVote create should validate option ownership'
)
assert.match(
  pollVoteSource,
  /每位會員每個投票只能投一票/,
  'PollVote create should validate one vote per member per poll'
)

assert.match(
  reportSource,
  /建立檢舉需要有效的會員登入狀態/,
  'Report frontend create should require a frontend member token'
)
assert.match(
  reportSource,
  /data\.reporter = \{ connect: \{ id: memberId \} \}/,
  'Report frontend create should bind reporter from the frontend bearer token'
)
assert.match(
  reportSource,
  /data\.status = 'pending'/,
  'Report frontend create should force pending status'
)
assert.match(
  reportSource,
  /data\.adminNotes = ''/,
  'Report frontend create should preserve a valid empty adminNotes value'
)
assert.match(
  reportSource,
  /update:[\s\S]+?delete:[\s\S]+?Report 操作僅限 CMS 管理者/,
  'Report non-CMS update/delete should remain blocked because resolved reports hide content'
)
