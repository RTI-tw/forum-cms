const assert = require('assert')
const fs = require('fs')
const path = require('path')

function sourceFor(fileName) {
  return fs.readFileSync(path.join(__dirname, fileName), 'utf8')
}

const postSource = sourceFor('Post.ts')
const commentSource = sourceFor('comment.ts')

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
