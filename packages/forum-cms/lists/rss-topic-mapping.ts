import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { checkbox, relationship, text } from '@keystone-6/core/fields'
import { isCronServiceRequest } from '../utils/cron-service-auth'

const listConfigurations = list({
  fields: {
    rssTopic: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: '央廣 RSS 主題',
      ui: {
        description: '必須與央廣 RSS category 的主題名稱相同。',
      },
    }),
    topic: relationship({
      ref: 'Topic.rssTopicMappings',
      many: false,
      label: '平台主題',
      ui: {
        description: '多個央廣 RSS 主題可對應至同一個平台主題。',
      },
    }),
    isEnabled: checkbox({
      label: '啟用',
      defaultValue: true,
    }),
    note: text({
      label: '備註',
      ui: { displayMode: 'textarea' },
    }),
  },
  ui: {
    label: 'RSS 主題合併',
    listView: {
      initialColumns: ['rssTopic', 'topic', 'isEnabled', 'note'],
    },
  },
  access: {
    operation: {
      query: async (auth) =>
        isCronServiceRequest(auth.context) ||
        allowRoles(admin, moderator, editor)(auth),
      update: allowRoles(admin, moderator, editor),
      create: allowRoles(admin, moderator, editor),
      delete: allowRoles(admin, editor),
    },
  },
})

export default utils.addTrackingFields(listConfigurations)
