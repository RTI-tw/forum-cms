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
  },
  ui: {
    label: '影片',
    listView: {
      initialColumns: ['url', 'coverImage'],
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
