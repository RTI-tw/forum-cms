import assert from 'assert'

type PostVisibilityModule = typeof import('./post-visibility')

function loadPostVisibility(strategy: string): PostVisibilityModule {
  process.env.ACCESS_CONTROL_STRATEGY = strategy

  for (const modulePath of [
    './post-visibility',
    '../environment-variables',
  ]) {
    const resolved = require.resolve(modulePath)
    delete require.cache[resolved]
  }

  return require('./post-visibility') as PostVisibilityModule
}

function createContextWithSession(itemId?: string | null) {
  return {
    session: itemId ? { itemId } : undefined,
  } as Parameters<PostVisibilityModule['canReadAllPostStatuses']>[0]
}

function testApiStrategyCanReadAllPostStatuses() {
  const { canReadAllPostStatuses, canReadTrustedBackendContent } =
    loadPostVisibility('api')

  assert.equal(
    canReadAllPostStatuses(createContextWithSession(null)),
    true,
    'api strategy should allow backend services such as message-services to read pending posts when API list rules allow Post query'
  )
  assert.equal(
    canReadTrustedBackendContent(createContextWithSession(null)),
    true,
    'api strategy should allow trusted backend services to read translatable content behind public visibility filters when list rules allow query'
  )
}

function testPublicPreviewStrategyCannotReadAllPostStatuses() {
  const { canReadAllPostStatuses, canReadTrustedBackendContent } =
    loadPostVisibility('preview')

  assert.equal(
    canReadAllPostStatuses(createContextWithSession(null)),
    false,
    'anonymous preview-strategy requests should still use public post visibility'
  )
  assert.equal(
    canReadTrustedBackendContent(createContextWithSession(null)),
    false,
    'anonymous preview-strategy requests should still use public visibility filters for translatable content'
  )
}

function testCmsSessionCanReadAllPostStatuses() {
  const { canReadAllPostStatuses, canReadTrustedBackendContent } =
    loadPostVisibility('preview')

  assert.equal(
    canReadAllPostStatuses(createContextWithSession('1')),
    true,
    'CMS sessions should continue to read all post statuses'
  )
  assert.equal(
    canReadTrustedBackendContent(createContextWithSession('1')),
    true,
    'CMS sessions should continue to read translatable content behind public visibility filters'
  )
}

function main() {
  const originalStrategy = process.env.ACCESS_CONTROL_STRATEGY
  try {
    testApiStrategyCanReadAllPostStatuses()
    testPublicPreviewStrategyCannotReadAllPostStatuses()
    testCmsSessionCanReadAllPostStatuses()
  } finally {
    if (originalStrategy === undefined) {
      delete process.env.ACCESS_CONTROL_STRATEGY
    } else {
      process.env.ACCESS_CONTROL_STRATEGY = originalStrategy
    }
  }
}

main()
