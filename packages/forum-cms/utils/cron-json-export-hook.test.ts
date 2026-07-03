const assert = require('assert')

export {}

process.env.CRON_SERVICES_URL = 'https://cron-services.example.test/'
process.env.MESSAGE_SERVICES_URL = 'https://message-services.example.test'
process.env.MESSAGE_SERVICES_HOOK_TIMEOUT_MS = '1000'

function requireFreshCronJsonExportHook() {
  delete require.cache[require.resolve('./cron-json-export-hook')]
  delete require.cache[require.resolve('../environment-variables')]
  return require('./cron-json-export-hook')
}

async function testCallsConfiguredEndpointsForRelevantOperations() {
  const originalFetch = global.fetch
  const calls: Array<{ url: string; method?: string }> = []

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method })
    return {
      ok: true,
      status: 200,
      text: async () => '',
    } as Response
  }) as typeof fetch

  try {
    const {
      createCronJsonExportHook,
      hasAnyResolvedField,
    } = requireFreshCronJsonExportHook()

    const hook = createCronJsonExportHook({
      label: 'test export',
      endpoints: ['/export/a', '/export/b'],
      shouldTrigger: ({
        operation,
        resolvedData,
      }: {
        operation: string
        resolvedData?: Record<string, unknown>
      }) =>
        operation !== 'update' ||
        hasAnyResolvedField(resolvedData, ['title']),
    })

    await hook({ operation: 'create', resolvedData: {} })
    await hook({ operation: 'update', resolvedData: { title: 'changed' } })
    await hook({ operation: 'update', resolvedData: { updatedAt: new Date() } })
    await hook({ operation: 'delete', resolvedData: {} })
    await hook({ operation: 'query', resolvedData: {} })

    assert.deepEqual(calls, [
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
      { url: 'https://cron-services.example.test/export/a', method: 'GET' },
      { url: 'https://cron-services.example.test/export/b', method: 'GET' },
    ])
  } finally {
    global.fetch = originalFetch
  }
}

async function testTriggerPredicates() {
  const {
    ADS_EXPORT_ENDPOINT,
    CURATED_POSTS_LATEST_POLLS_EXPORT_ENDPOINT,
    HOME_EDITOR_CHOICES_EXPORT_ENDPOINT,
    shouldTriggerAdJsonExport,
    shouldTriggerAdSlideJsonExport,
    shouldTriggerEditorChoiceJsonExport,
    shouldTriggerPostJsonExport,
  } = requireFreshCronJsonExportHook()

  assert.equal(
    HOME_EDITOR_CHOICES_EXPORT_ENDPOINT,
    '/export/home-editor-choices-to-gcs?prefix=json/home-sections&limit=100&post_state=active&scan_multiplier=10&cache_control_seconds=300'
  )
  assert.equal(
    CURATED_POSTS_LATEST_POLLS_EXPORT_ENDPOINT,
    '/export/curated-posts-latest-polls-to-gcs?prefix=json/curated&limit=100&post_state=active&scan_multiplier=10&cache_control_seconds=60'
  )
  assert.equal(
    ADS_EXPORT_ENDPOINT,
    '/export/ads-to-gcs?prefix=json/ads&take=1&cache_control_seconds=300'
  )

  assert.equal(
    shouldTriggerEditorChoiceJsonExport({
      operation: 'update',
      resolvedData: { sortOrder: 10 },
    }),
    true
  )
  assert.equal(
    shouldTriggerEditorChoiceJsonExport({
      operation: 'update',
      resolvedData: { updatedAt: new Date() },
    }),
    false
  )
  assert.equal(
    shouldTriggerPostJsonExport({
      operation: 'update',
      resolvedData: { isRtiChoice: true },
    }),
    true
  )
  assert.equal(
    shouldTriggerPostJsonExport({
      operation: 'update',
      resolvedData: { updatedAt: new Date() },
    }),
    false
  )
  assert.equal(
    shouldTriggerAdJsonExport({
      operation: 'update',
      resolvedData: { mobileImage: { connect: { id: 1 } } },
    }),
    true
  )
  assert.equal(
    shouldTriggerAdJsonExport({
      operation: 'update',
      resolvedData: { updatedAt: new Date() },
    }),
    false
  )
  assert.equal(
    shouldTriggerAdSlideJsonExport({
      operation: 'update',
      resolvedData: { sortOrder: 1 },
    }),
    true
  )
  assert.equal(
    shouldTriggerAdSlideJsonExport({
      operation: 'update',
      resolvedData: { updatedAt: new Date() },
    }),
    false
  )
  assert.equal(shouldTriggerPostJsonExport({ operation: 'create' }), true)
  assert.equal(shouldTriggerPostJsonExport({ operation: 'delete' }), true)
}

async function testNonOkResponsesAreLoggedAndSwallowed() {
  const originalFetch = global.fetch
  const originalError = console.error
  const errors: string[] = []

  global.fetch = (async () => ({
    ok: false,
    status: 503,
    text: async () => 'upstream unavailable',
  } as Response)) as typeof fetch
  console.error = (message?: unknown) => {
    errors.push(String(message))
  }

  try {
    const { createCronJsonExportHook } = requireFreshCronJsonExportHook()
    const hook = createCronJsonExportHook({
      label: 'test export',
      endpoints: ['/export/failing'],
    })

    await hook({ operation: 'create' })

    assert.equal(errors.length, 1)
    assert.match(errors[0], /"status":503/)
    assert.match(errors[0], /upstream unavailable/)
  } finally {
    global.fetch = originalFetch
    console.error = originalError
  }
}

async function testThrownFetchErrorsAreLoggedAndSwallowed() {
  const originalFetch = global.fetch
  const originalError = console.error
  const errors: string[] = []

  global.fetch = (async () => {
    throw new Error('network down')
  }) as typeof fetch
  console.error = (message?: unknown) => {
    errors.push(String(message))
  }

  try {
    const { createCronJsonExportHook } = requireFreshCronJsonExportHook()
    const hook = createCronJsonExportHook({
      label: 'test export',
      endpoints: ['/export/throws'],
    })

    await hook({ operation: 'create' })

    assert.equal(errors.length, 1)
    assert.match(errors[0], /network down/)
  } finally {
    global.fetch = originalFetch
    console.error = originalError
  }
}

async function testMissingCronServicesUrlSkipsNetworkCalls() {
  const originalFetch = global.fetch
  const originalWarn = console.warn
  const originalCronServicesUrl = process.env.CRON_SERVICES_URL
  const calls: string[] = []
  const warnings: string[] = []

  delete process.env.CRON_SERVICES_URL
  global.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return { ok: true, status: 200, text: async () => '' } as Response
  }) as typeof fetch
  console.warn = (message?: unknown) => {
    warnings.push(String(message))
  }

  try {
    const { createCronJsonExportHook } = requireFreshCronJsonExportHook()
    const hook = createCronJsonExportHook({
      label: 'test export',
      endpoints: ['/export/skipped'],
    })

    await hook({ operation: 'create' })

    assert.deepEqual(calls, [])
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /CRON_SERVICES_URL/)
  } finally {
    global.fetch = originalFetch
    console.warn = originalWarn
    process.env.CRON_SERVICES_URL = originalCronServicesUrl
  }
}

async function main() {
  await testCallsConfiguredEndpointsForRelevantOperations()
  await testTriggerPredicates()
  await testNonOkResponsesAreLoggedAndSwallowed()
  await testThrownFetchErrorsAreLoggedAndSwallowed()
  await testMissingCronServicesUrlSkipsNetworkCalls()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
