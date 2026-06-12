import assert from 'assert'
import test from 'node:test'
import {
  buildEventPreviewItem,
  getEventPreviewAvailabilityStatus,
} from './event-registration-gql'

const now = new Date('2026-06-12T04:00:00.000Z')

test('event preview status closes after registration end time', () => {
  assert.equal(
    getEventPreviewAvailabilityStatus(
      {
        endAt: '2026-06-13T04:00:00.000Z',
        registrationEndAt: '2026-06-12T03:59:59.000Z',
        capacity: 100,
      },
      10,
      now
    ),
    'closed'
  )
})

test('event preview status reports full when active registrations reach capacity', () => {
  assert.equal(
    getEventPreviewAvailabilityStatus(
      {
        endAt: '2026-06-13T04:00:00.000Z',
        registrationEndAt: '2026-06-12T05:00:00.000Z',
        capacity: 10,
      },
      10,
      now
    ),
    'full'
  )
})

test('event preview status reports notStarted before registration start time', () => {
  assert.equal(
    getEventPreviewAvailabilityStatus(
      {
        endAt: '2026-06-13T04:00:00.000Z',
        registrationStartAt: '2026-06-12T05:00:00.000Z',
        registrationEndAt: '2026-06-12T06:00:00.000Z',
        capacity: 10,
      },
      0,
      now
    ),
    'notStarted'
  )
})

test('registered member state is separate from event availability status', () => {
  const item = buildEventPreviewItem(
    {
      id: 1,
      slug: 'sample-event',
      label: 'hot',
      notice: '- 請準時入場',
      startAt: '2026-06-13T02:00:00.000Z',
      endAt: '2026-06-13T04:00:00.000Z',
      registrationStartAt: '2026-06-01T04:00:00.000Z',
      registrationEndAt: '2026-06-12T05:00:00.000Z',
      capacity: 10,
      post: {
        id: 3,
        title: 'Sample Event',
        status: 'published',
        heroImages: [],
      },
    },
    3,
    true,
    now
  )

  assert.equal(item.availabilityStatus, 'open')
  assert.equal(item.isRegistered, true)
})
