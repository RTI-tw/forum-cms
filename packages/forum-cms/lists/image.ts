import envVar from '../environment-variables'
import { list, graphql } from '@keystone-6/core'
import { image, text, virtual, integer, relationship } from '@keystone-6/core/fields'
import { utils } from '@mirrormedia/lilith-core'
import { getImagePublicUrl } from '../utils/common'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'

const listConfigurations = list({
  db: {
    map: 'Image',
  },
  fields: {
    name: text({
      label: '標題',
      validation: { isRequired: false },
      ui: {
        description: '可留空；從文章主圖新增時僅需上傳檔案與順序。',
      },
    }),
    file: image({
      label: '檔案',
      storage: 'images',
      ui: { views: './lists/views/custom-image/index' },
    }),
    resized: virtual({
      field: graphql.field({
        type: graphql.object<{
          original: string
          w480: string
          w800: string
          w1200: string
          w1600: string
          w2400: string
        }>()({
          name: 'ResizedImages',
          fields: {
            original: graphql.field({ type: graphql.String }),
            w480: graphql.field({ type: graphql.String }),
            w800: graphql.field({ type: graphql.String }),
            w1200: graphql.field({ type: graphql.String }),
            w1600: graphql.field({ type: graphql.String }),
            w2400: graphql.field({ type: graphql.String }),
          },
        }),
        resolve(item: Record<string, unknown>) {
          const empty = {
            original: '',
            w480: '',
            w800: '',
            w1200: '',
            w1600: '',
            w2400: '',
          }

          // For backward compatibility,
          // this image item is uploaded via `GCSFile` custom field.
          if (item?.urlOriginal) {
            return Object.assign(empty, {
              original: item.urlOriginal,
            })
          }

          const rtn: Record<string, string> = {}
          const filename = item?.file_id

          if (!filename) {
            return empty
          }

          const extension = item?.file_extension
            ? '.' + item.file_extension
            : ''
          const width = typeof item?.file_width === 'number' ? item.file_width : 0
          const height = typeof item?.file_height === 'number' ? item.file_height : 0

          const resizedTargets =
            width >= height
              ? ['w480', 'w800', 'w1600', 'w2400']
              : ['w480', 'w800', 'w1200', 'w1600']

          resizedTargets.forEach((target) => {
            rtn[target] = getImagePublicUrl(
              envVar.gcs.publicBaseUrl,
              envVar.gcs.bucket,
              envVar.images.baseUrl,
              `${filename}-${target}${extension}`
            )
          })

          rtn['original'] = getImagePublicUrl(
            envVar.gcs.publicBaseUrl,
            envVar.gcs.bucket,
            envVar.images.baseUrl,
            `${filename}${extension}`
          )
          return Object.assign(empty, rtn)
        },
      }),
      ui: {
        query: '{ original w480 w800 w1200 w1600 w2400 }',
      },
    }),
    resizedWebp: virtual({
      field: graphql.field({
        type: graphql.object<{
          original: string
          w480: string
          w800: string
          w1200: string
          w1600: string
          w2400: string
        }>()({
          name: 'ResizedWebPImages',
          fields: {
            original: graphql.field({ type: graphql.String }),
            w480: graphql.field({ type: graphql.String }),
            w800: graphql.field({ type: graphql.String }),
            w1200: graphql.field({ type: graphql.String }),
            w1600: graphql.field({ type: graphql.String }),
            w2400: graphql.field({ type: graphql.String }),
          },
        }),
        resolve(item: Record<string, unknown>) {
          const empty = {
            original: '',
            w480: '',
            w800: '',
            w1200: '',
            w1600: '',
            w2400: '',
          }

          // For backward compatibility,
          // this image item is uploaded via `GCSFile` custom field.
          if (item?.urlOriginal) {
            return Object.assign(empty, {
              original: item.urlOriginal,
            })
          }

          const rtn: Record<string, string> = {}
          const filename = item?.file_id

          if (!filename) {
            return empty
          }

          const extension = '.webP'

          const width =
            typeof item?.file_width === 'number' ? item.file_width : 0
          const height =
            typeof item?.file_height === 'number'
              ? item.file_height
              : 0

          const resizedTargets =
            width >= height
              ? ['w480', 'w800', 'w1600', 'w2400']
              : ['w480', 'w800', 'w1200', 'w1600']

          resizedTargets.forEach((target) => {
            rtn[target] = getImagePublicUrl(
              envVar.gcs.publicBaseUrl,
              envVar.gcs.bucket,
              envVar.images.baseUrl,
              `${filename}-${target}${extension}`
            )
          })

          rtn['original'] = getImagePublicUrl(
            envVar.gcs.publicBaseUrl,
            envVar.gcs.bucket,
            envVar.images.baseUrl,
            `${filename}${extension}`
          )
          return Object.assign(empty, rtn)
        },
      }),
      ui: {
        query: '{ original w480 w800 w1200 w1600 w2400 }',
      },
    }),
    urlOriginal: text({
      label: '原始連結',
      ui: {
        createView: { fieldMode: 'hidden' },
        // itemView: { fieldMode: 'read' },
      },
    }),
    altText: text({ label: '替代文字' }),
    caption: text({ label: '圖片說明' }),
    width: integer({ label: '原始寬度' }),
    height: integer({ label: '原始高度' }),
    sortOrder: integer({
      label: '顯示順序',
      defaultValue: 0,
      ui: {
        description: '作為文章主圖時的排序；數字越小越靠前。',
      },
    }),
    uploadedBy: relationship({ ref: 'Member', many: false, label: '上傳者' }),
    postsAsHeroImages: relationship({
      ref: 'Post.heroImages',
      many: true,
      label: '作為主圖的文章',
      ui: {
        description:
          '引用此圖為主圖的文章（與「文章」內主圖欄位為同一關聯，兩邊皆可檢視／連結）。',
        displayMode: 'cards',
        cardFields: ['title', 'status', 'published_date'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
    staticContents: relationship({
      ref: 'Content.photos',
      many: true,
      label: '靜態頁面',
      ui: {
        description: '使用此圖的靜態頁（與「靜態頁面」之圖片欄位為同一關聯）。',
        displayMode: 'cards',
        cardFields: ['identifier', 'title', 'language'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
  },
  ui: {
    label: '圖片',
    listView: {
      initialColumns: [
        'name',
        'urlOriginal',
        'postsAsHeroImages',
        'staticContents',
      ],
      initialSort: { field: 'name', direction: 'ASC' },
      pageSize: 50,
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator),
      create: allowRoles(admin, moderator),
      delete: allowRoles(admin),
    },
  },

})

export default utils.addTrackingFields(listConfigurations)
