export type AdFormat = 'single_image' | 'carousel' | 'video' | 'third_party'

const DEFAULT_AD_FORMAT: AdFormat = 'single_image'

const AD_FORMATS = new Set<AdFormat>([
  'single_image',
  'carousel',
  'video',
  'third_party',
])

const FIELD_FORMATS: Record<string, readonly AdFormat[]> = {
  image: ['single_image'],
  slides: ['carousel'],
  videoUrl: ['video'],
  videoFile: ['video'],
  adCode: ['third_party'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAdFormat(value: unknown): value is AdFormat {
  return typeof value === 'string' && AD_FORMATS.has(value as AdFormat)
}

function readSelectValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
  }

  if (!isRecord(value)) {
    return undefined
  }

  const selected = value.value
  if (typeof selected === 'string') {
    return selected
  }

  if (isRecord(selected) && typeof selected.value === 'string') {
    return selected.value
  }

  return undefined
}

export function getCurrentAdFormat(itemValue: unknown): AdFormat {
  if (!isRecord(itemValue)) {
    return DEFAULT_AD_FORMAT
  }

  const formatState = itemValue.format
  if (typeof formatState === 'string') {
    return isAdFormat(formatState) ? formatState : DEFAULT_AD_FORMAT
  }

  if (!isRecord(formatState)) {
    return DEFAULT_AD_FORMAT
  }

  const rawFormat =
    formatState.kind === 'value'
      ? readSelectValue(formatState.value)
      : readSelectValue(formatState)

  return isAdFormat(rawFormat) ? rawFormat : DEFAULT_AD_FORMAT
}

export function isAdFormatFieldVisible(
  fieldPath: string,
  itemValue: unknown
): boolean {
  const visibleFormats = FIELD_FORMATS[fieldPath]
  if (!visibleFormats) {
    return true
  }

  return visibleFormats.includes(getCurrentAdFormat(itemValue))
}
