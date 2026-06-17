import assert from 'assert'
import test from 'node:test'
import {
  getCurrentAdFormat,
  isAdFormatFieldVisible,
} from './helpers'

function itemValueFor(format: string | null, kind: 'create' | 'update' = 'create') {
  return {
    format: {
      kind: 'value',
      value:
        kind === 'create'
          ? {
              kind: 'create',
              value: format ? { label: format, value: format } : null,
            }
          : {
              kind: 'update',
              initial: format ? { label: format, value: format } : null,
              value: format ? { label: format, value: format } : null,
            },
    },
  }
}

test('reads the current ad format from Keystone create form state', () => {
  assert.equal(getCurrentAdFormat(itemValueFor('carousel')), 'carousel')
})

test('reads the current ad format from Keystone update form state', () => {
  assert.equal(getCurrentAdFormat(itemValueFor('third_party', 'update')), 'third_party')
})

test('defaults to single image when the form state has no selected format', () => {
  assert.equal(getCurrentAdFormat(itemValueFor(null)), 'single_image')
  assert.equal(getCurrentAdFormat({}), 'single_image')
})

test('shows only fields that belong to the current ad format', () => {
  assert.equal(isAdFormatFieldVisible('image', itemValueFor('single_image')), true)
  assert.equal(isAdFormatFieldVisible('slides', itemValueFor('single_image')), false)

  assert.equal(isAdFormatFieldVisible('slides', itemValueFor('carousel')), true)
  assert.equal(isAdFormatFieldVisible('image', itemValueFor('carousel')), false)

  assert.equal(isAdFormatFieldVisible('videoUrl', itemValueFor('video')), true)
  assert.equal(isAdFormatFieldVisible('videoFile', itemValueFor('video')), true)
  assert.equal(isAdFormatFieldVisible('adCode', itemValueFor('video')), false)

  assert.equal(isAdFormatFieldVisible('adCode', itemValueFor('third_party')), true)
  assert.equal(isAdFormatFieldVisible('videoUrl', itemValueFor('third_party')), false)
})
