import assert from 'assert'

process.env.CRON_SERVICES_URL = 'https://cron-services.example.test/'
process.env.MESSAGE_SERVICES_URL = 'https://message-services.example.test'
process.env.MESSAGE_SERVICES_HOOK_TIMEOUT_MS = '1000'

async function main() {
  const originalFetch = global.fetch
  const calls: Array<{ url: string; method?: string; body?: unknown }> = []

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
    const { createContentJsonExportHook } = require('./content-json-export-hook')
    const hook = createContentJsonExportHook()

    await hook({ operation: 'create' })

    assert.deepEqual(calls, [
      {
        url: 'https://cron-services.example.test/export/contents-to-gcs',
        method: 'GET',
        body: undefined,
      },
    ])
  } finally {
    global.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
