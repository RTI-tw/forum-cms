const assert = require('assert')
const fs = require('fs')
const path = require('path')

const postSource = fs.readFileSync(path.join(__dirname, 'Post.ts'), 'utf8')
const commentSource = fs.readFileSync(path.join(__dirname, 'comment.ts'), 'utf8')
const pollOptionSource = fs.readFileSync(
  path.join(__dirname, 'poll-option.ts'),
  'utf8'
)
const moderationSource = fs.readFileSync(
  path.join(__dirname, '../utils/cms-content-moderation.ts'),
  'utf8'
)

assert.match(
  moderationSource,
  /getPartnerMemberId\(context\)/,
  'CMS moderation should recognize the member mapped to a partner session'
)
assert.match(
  commentSource,
  /const allowed = new Set\(\[\s*'content',/,
  'Partners should be allowed to update original comment content'
)
assert.match(
  commentSource,
  /content: text\(\{[\s\S]*?itemView: \{ fieldMode: 'edit' \}/,
  'Original comment content should be editable in the partner item view'
)
assert.doesNotMatch(
  pollOptionSource,
  /operation === 'create' && pollId == null/,
  'Inline poll options may be created before the parent Poll has an id'
)
assert.match(
  postSource,
  /data\.author = \{ connect: \{ id: memberId \} \}/,
  'Partner post creates should bind the mapped partner member as author'
)
assert.match(
  postSource,
  /operation === 'create'[\s\S]+isPartnerSession\(context\)[\s\S]+data\.status = 'draft'[\s\S]+return data/,
  'Partner post creates should use the dedicated CMS create path'
)
