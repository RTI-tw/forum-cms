export type EventPreviewAvailabilityStatus =
  | 'open'
  | 'notStarted'
  | 'full'
  | 'closed'

function isBefore(value: Date | string | null | undefined, now: Date) {
  return Boolean(value && new Date(value).getTime() > now.getTime())
}

function isAfter(value: Date | string | null | undefined, now: Date) {
  return Boolean(value && new Date(value).getTime() < now.getTime())
}

export function getEventPreviewAvailabilityStatus(
  event: {
    endAt?: Date | string | null
    registrationStartAt?: Date | string | null
    registrationEndAt?: Date | string | null
    capacity?: number | null
  },
  registrationCount = 0,
  now = new Date()
): EventPreviewAvailabilityStatus {
  if (isAfter(event.endAt, now) || isAfter(event.registrationEndAt, now)) {
    return 'closed'
  }

  if (isBefore(event.registrationStartAt, now)) {
    return 'notStarted'
  }

  if (
    typeof event.capacity === 'number' &&
    registrationCount >= event.capacity
  ) {
    return 'full'
  }

  return 'open'
}
