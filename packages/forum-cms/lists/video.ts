import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, relationship } from '@keystone-6/core/fields'

const listConfigurations = list({
  fields: {
    url: text({
      validation: { isRequired: true },
      label: '外部連結',
    }),
    coverImage: text({
      label: '影片縮圖',
    }),
    post: relationship({
      ref: 'Post.videos',
      many: false,
      label: '關聯文章',
    }),
    staticContents: relationship({
      ref: 'Content.videos',
      many: true,
      label: '靜態頁面',
      ui: {
        description: '使用此影片的靜態頁（與「靜態頁面」之影片欄位為同一關聯）。',
        displayMode: 'cards',
        cardFields: ['identifier', 'title', 'language'],
        linkToItem: true,
        inlineConnect: true,
        removeMode: 'disconnect',
      },
    }),
  },
  ui: {
    label: '影片',
    listView: {
      initialColumns: ['url', 'coverImage', 'post', 'staticContents'],
    },
  },
  access: {
    operation: {
      query: allowRoles(admin, moderator, editor),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
