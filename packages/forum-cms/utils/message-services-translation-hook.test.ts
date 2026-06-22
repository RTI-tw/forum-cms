import assert from 'assert'

process.env.MESSAGE_SERVICES_URL = 'https://message-services.example.test'
process.env.MESSAGE_SERVICES_HOOK_TIMEOUT_MS = '1000'
delete process.env.MESSAGE_SERVICES_TRANSLATION_PUBSUB_TOPIC
delete process.env.MESSAGE_SERVICES_TRANSLATION_PUBSUB_PROJECT_ID

type FetchCall = {
  url: string
  method?: string
  body?: unknown
}

async function withCapturedFetch(run: (calls: FetchCall[]) => Promise<void>) {
  const originalFetch = global.fetch
  const calls: FetchCall[] = []

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body,
    })
    return {
      ok: true,
      status: 200,
      text: async () => '',
    } as Response
  }) as typeof fetch

  try {
    await run(calls)
  } finally {
    global.fetch = originalFetch
  }
}

async function testPostUpdateWithoutSubmittedTitleOrContentSkipsTranslation() {
  const {
    createMessageServicesTranslationHook,
  } = require('./message-services-translation-hook')
  const hook = createMessageServicesTranslationHook('post')

  await withCapturedFetch(async (calls) => {
    await hook({
      operation: 'update',
      item: {
        id: 42,
        title: 'Existing title',
        content: 'Existing content',
        status: 'published',
      },
      originalItem: {
        id: 42,
        status: 'draft',
      },
      resolvedData: {
        status: 'published',
      },
    })

    assert.deepEqual(
      calls,
      [],
      'Post update should not trigger translation when resolvedData does not modify title or content'
    )
  })
}

async function main() {
  await testPostUpdateWithoutSubmittedTitleOrContentSkipsTranslation()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
