import assert from 'assert'
import fs from 'fs'
import path from 'path'
import test from 'node:test'

const adSource = fs.readFileSync(path.join(__dirname, 'ad.ts'), 'utf8')
const adSlideSource = fs.readFileSync(path.join(__dirname, 'ad-slide.ts'), 'utf8')
const prismaSchema = fs.readFileSync(
  path.join(__dirname, '../schema.prisma'),
  'utf8'
)

function relationshipFieldSource(source: string, fieldName: string) {
  return source.match(
    new RegExp(`${fieldName}:\\s+relationship\\(\\{[\\s\\S]+?\\n    \\}\\),`)
  )?.[0]
}

test('ad format fields use live format-aware Admin UI views', () => {
  assert.match(adSource, /formatAwareRelationshipView/)
  assert.match(adSource, /formatAwareTextView/)
  assert.match(adSource, /formatAwareFileView/)

  for (const fieldName of ['image', 'mobileImage', 'slides']) {
    const fieldConfig = relationshipFieldSource(adSource, fieldName)
    assert.ok(fieldConfig, `${fieldName} field should exist`)
    assert.match(fieldConfig, /views:\s*formatAwareRelationshipView/)
  }

  for (const fieldName of ['videoUrl', 'adCode']) {
    const fieldConfig = adSource.match(
      new RegExp(`${fieldName}:\\s+text\\(\\{[\\s\\S]+?\\n    \\}\\),`)
    )?.[0]
    assert.ok(fieldConfig, `${fieldName} field should exist`)
    assert.match(fieldConfig, /views:\s*formatAwareTextView/)
  }

  const videoFileConfig = adSource.match(
    /videoFile:\s+file\(\{[\s\S]+?\n    \}\),/
  )?.[0]
  assert.ok(videoFileConfig, 'videoFile field should exist')
  assert.match(videoFileConfig, /views:\s*formatAwareFileView/)
})

test('ad format fields are not hidden by persisted item format metadata', () => {
  assert.doesNotMatch(adSource, /visibleForFormat/)
})

test('single image ad keeps image as desktop field and adds mobile image field', () => {
  const desktopField = relationshipFieldSource(adSource, 'image')
  const mobileField = relationshipFieldSource(adSource, 'mobileImage')

  assert.ok(desktopField, 'Ad.image field should exist')
  assert.ok(mobileField, 'Ad.mobileImage field should exist')
  assert.match(desktopField, /label:\s*'桌機廣告圖片 Desktop image（單張靜態圖）'/)
  assert.match(mobileField, /label:\s*'手機版廣告圖片 Mobile image（單張靜態圖）'/)
  assert.match(mobileField, /ref:\s*'Photo'/)
  assert.match(mobileField, /views:\s*formatAwareRelationshipView/)
})

test('carousel slide keeps image as desktop field and adds mobile image field', () => {
  const desktopField = relationshipFieldSource(adSlideSource, 'image')
  const mobileField = relationshipFieldSource(adSlideSource, 'mobileImage')

  assert.ok(desktopField, 'AdSlide.image field should exist')
  assert.ok(mobileField, 'AdSlide.mobileImage field should exist')
  assert.match(desktopField, /label:\s*'桌機廣告圖片 Desktop image'/)
  assert.match(mobileField, /label:\s*'手機版廣告圖片 Mobile image'/)
  assert.match(desktopField, /views:\s*formatAwareRelationshipView/)
  assert.match(mobileField, /views:\s*formatAwareRelationshipView/)
  assert.match(adSlideSource, /cardFields:\s*\['name', 'urlOriginal', 'altText'\]/)
})

test('ad carousel cards expose desktop and mobile slide images inline', () => {
  const slidesField = relationshipFieldSource(adSource, 'slides')
  assert.ok(slidesField, 'Ad.slides field should exist')
  assert.match(slidesField, /cardFields:\s*\['image', 'mobileImage', 'linkUrl', 'sortOrder'\]/)
  assert.match(slidesField, /inlineCreate:\s*\{\s*fields:\s*\['image', 'mobileImage', 'linkUrl', 'sortOrder'\]\s*\}/)
  assert.match(slidesField, /inlineEdit:\s*\{\s*fields:\s*\['image', 'mobileImage', 'linkUrl', 'sortOrder'\]\s*\}/)
})

test('prisma schema stores mobile image relationships for ads and ad slides', () => {
  const photoModel = prismaSchema.match(/model Photo \{[\s\S]+?\n\}/)?.[0]
  const adModel = prismaSchema.match(/model Ad \{[\s\S]+?\n\}/)?.[0]
  const adSlideModel = prismaSchema.match(/model AdSlide \{[\s\S]+?\n\}/)?.[0]

  assert.ok(photoModel)
  assert.ok(adModel)
  assert.ok(adSlideModel)
  assert.match(photoModel, /from_Ad_mobileImage\s+Ad\[\]\s+@relation\("Ad_mobileImage"\)/)
  assert.match(photoModel, /from_AdSlide_mobileImage\s+AdSlide\[\]\s+@relation\("AdSlide_mobileImage"\)/)
  assert.match(adModel, /mobileImage\s+Photo\?\s+@relation\("Ad_mobileImage", fields: \[mobileImageId\], references: \[id\]\)/)
  assert.match(adModel, /mobileImageId\s+Int\?\s+@map\("mobileImage"\)/)
  assert.match(adModel, /@@index\(\[mobileImageId\]\)/)
  assert.match(adSlideModel, /mobileImage\s+Photo\?\s+@relation\("AdSlide_mobileImage", fields: \[mobileImageId\], references: \[id\]\)/)
  assert.match(adSlideModel, /mobileImageId\s+Int\?\s+@map\("mobileImage"\)/)
  assert.match(adSlideModel, /@@index\(\[mobileImageId\]\)/)
})
