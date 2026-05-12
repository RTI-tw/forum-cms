import assert from 'assert'
import { fetchWithTimeout } from './fetch-with-timeout'

async function testAbortSlowFetch() {
  const originalFetch = global.fetch
  let observedAbort = false

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        observedAbort = true
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })
    throw new Error('unreachable')
  }) as typeof fetch

  try {
    await assert.rejects(
      fetchWithTimeout(
        'https://message-services.example.test/hooks/sync-translations',
        { method: 'POST' },
        10,
        'message-services sync-translations timed out after 10ms'
      ),
      /message-services sync-translations timed out after 10ms/
    )
    assert.equal(observedAbort, true)
  } finally {
    global.fetch = originalFetch
  }
}

async function testPassesThroughFastFetch() {
  const originalFetch = global.fetch
  const response = { ok: true, status: 202 } as Response

  global.fetch = (async () => response) as typeof fetch

  try {
    const result = await fetchWithTimeout(
      'https://cron-services.example.test/export/contents-to-gcs',
      { method: 'GET' },
      1000,
      'cron-services export timed out after 1000ms'
    )
    assert.equal(result, response)
  } finally {
    global.fetch = originalFetch
  }
}

async function main() {
  await testAbortSlowFetch()
  await testPassesThroughFastFetch()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
