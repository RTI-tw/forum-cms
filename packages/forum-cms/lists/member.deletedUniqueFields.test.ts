import assert from 'assert'
import Member from './member'

async function resolveMemberInput(
  resolvedData: Record<string, unknown>,
  item: Record<string, unknown>
) {
  const resolveInput = (Member as any).hooks?.resolveInput
  assert.equal(typeof resolveInput, 'function')

  return await resolveInput({
    resolvedData,
    item,
    context: { session: null },
  })
}

async function testDeletedStatusReleasesUniqueMemberFields() {
  const output = await resolveMemberInput(
    { status: 'deleted' },
    {
      id: 123,
      status: 'active',
      email: 'user@example.com',
      firebaseId: 'firebase-uid',
      customId: 'custom-id',
      name: 'Test User',
      nickname: 'Tester',
    }
  )

  assert.equal(output.status, 'deleted')
  assert.equal(output.email, 'DELETED-123-user@example.com')
  assert.equal(output.firebaseId, 'DELETED-123-firebase-uid')
  assert.equal(output.customId, 'DELETED-123-custom-id')
}

async function testDeletedStatusDoesNotRewriteAlreadyDeletedMember() {
  const output = await resolveMemberInput(
    { status: 'deleted' },
    {
      id: 123,
      status: 'deleted',
      email: 'DELETED-123-user@example.com',
      firebaseId: 'DELETED-123-firebase-uid',
      customId: 'DELETED-123-custom-id',
      name: 'Test User',
      nickname: 'Tester',
    }
  )

  assert.equal(output.status, 'deleted')
  assert.equal(output.email, undefined)
  assert.equal(output.firebaseId, undefined)
  assert.equal(output.customId, undefined)
}

async function main() {
  await testDeletedStatusReleasesUniqueMemberFields()
  await testDeletedStatusDoesNotRewriteAlreadyDeletedMember()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
