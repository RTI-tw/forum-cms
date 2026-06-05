import assert from 'assert'
import {
  normalizeEventRegistrationForm,
  isRegistrationOpen,
} from './event-registration-gql'

declare const test: (name: string, fn: () => void) => void

test('normalizes and hashes event registration form identifiers', () => {
  const output = normalizeEventRegistrationForm({
    identityType: 'national_id',
    identityNumber: ' a123456789 ',
    phoneNumber: ' 0912-345-678 ',
  })

  assert.equal(output.identityType, 'national_id')
  assert.equal(output.identityMasked, 'A1******89')
  assert.equal(output.phoneMasked, '0912***678')
  assert.match(output.identityHash, /^[a-f0-9]{64}$/)
  assert.match(output.phoneHash, /^[a-f0-9]{64}$/)
  assert.notEqual(output.identityHash, 'A123456789')
  assert.notEqual(output.phoneHash, '0912345678')
})

test('rejects unsupported identity type and empty phone number', () => {
  assert.throws(
    () =>
      normalizeEventRegistrationForm({
        identityType: 'passport',
        identityNumber: 'A123456789',
        phoneNumber: '0912345678',
      }),
    /證件類型/
  )

  assert.throws(
    () =>
      normalizeEventRegistrationForm({
        identityType: 'national_id',
        identityNumber: 'A123456789',
        phoneNumber: '',
      }),
    /手機號碼/
  )
})

test('registration window treats missing bounds as open', () => {
  const now = new Date('2026-06-05T12:00:00.000Z')
  assert.equal(isRegistrationOpen({}, now), true)
  assert.equal(
    isRegistrationOpen({ registrationStartAt: '2026-06-05T13:00:00.000Z' }, now),
    false
  )
  assert.equal(
    isRegistrationOpen({ registrationEndAt: '2026-06-05T11:00:00.000Z' }, now),
    false
  )
})
