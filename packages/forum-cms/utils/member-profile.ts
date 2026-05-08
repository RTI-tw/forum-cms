function normalizeText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function computeIsCompleteProfile(input: {
  firebaseId?: string | null
  customId?: string | null
  name?: string | null
  nickname?: string | null
}): boolean {
  const firebaseId = normalizeText(input.firebaseId)
  const customId = normalizeText(input.customId)
  const name = normalizeText(input.name)
  const nickname = normalizeText(input.nickname)

  return Boolean(
    firebaseId &&
      customId &&
      customId !== firebaseId &&
      name &&
      nickname
  )
}
