const assert = require('assert')
const fs = require('fs')
const path = require('path')

function sourceFor(fileName) {
  return fs.readFileSync(path.join(__dirname, fileName), 'utf8')
}

const postSource = sourceFor('Post.ts')
const commentSource = sourceFor('comment.ts')
const bookmarkSource = sourceFor('bookmark.ts')
const pollVoteSource = sourceFor('poll-vote.ts')
const reportSource = sourceFor('report.ts')

assert.doesNotMatch(
  postSource,
  /建立文章需要有效的會員登入狀態/,
  'Post create should not require a CMS-session OfficialMapping for non-CMS GraphQL writes'
)

assert.doesNotMatch(
  postSource,
  /\[AC-005\][\s\S]+?getOfficialMemberIdForSessionUser/,
  'Post create should not keep the removed AC-005 non-CMS forced author override'
)

assert.doesNotMatch(
  commentSource,
  /建立留言需要有效的會員登入狀態/,
  'Comment create should not require a CMS-session OfficialMapping for non-CMS GraphQL writes'
)

assert.doesNotMatch(
  commentSource,
  /\[AC-006\][\s\S]+?getOfficialMemberIdForSessionUser/,
  'Comment create should not keep the removed AC-006 non-CMS forced member override'
)

assert.doesNotMatch(
  bookmarkSource,
  /書籤操作需要有效的會員登入狀態/,
  'Bookmark writes should not require a frontend member token in list hooks when GraphQL is ingress-only'
)

assert.doesNotMatch(
  bookmarkSource,
  /\[AC-007\][\s\S]+?resolveInput/,
  'Bookmark should not keep the removed AC-007 non-CMS write binding hook'
)

assert.doesNotMatch(
  pollVoteSource,
  /投票紀錄需要有效的會員登入狀態/,
  'PollVote writes should not require a frontend member token in list hooks when GraphQL is ingress-only'
)

assert.doesNotMatch(
  pollVoteSource,
  /\[AC-008\][\s\S]+?getAuthenticatedMemberId/,
  'PollVote should not keep the removed AC-008 non-CMS write validation hook'
)

assert.doesNotMatch(
  reportSource,
  /Report 操作僅限 CMS 管理者/,
  'Report writes should not be blocked as CMS-only in list hooks when GraphQL is ingress-only'
)
