import { utils } from '@mirrormedia/lilith-core'
import { allowRoles, admin, moderator, editor } from '../utils/access-control'
import { list } from '@keystone-6/core'
import { text, checkbox, select } from '@keystone-6/core/fields'
import { isCronServiceRequest } from '../utils/cron-service-auth'

const listConfigurations = list({
  fields: {
    keyword: text({
      validation: { isRequired: true },
      isIndexed: 'unique',
      label: '關鍵字',
      ui: {
        description: '用來比對央廣 RSS 新聞標題與內容的字詞。',
      },
    }),
    language: select({
      label: '語言',
      type: 'enum',
      validation: { isRequired: true },
      options: [
        { label: '中文', value: 'zh' },
        { label: 'English', value: 'en' },
        { label: 'Tiếng Việt', value: 'vi' },
        { label: 'Bahasa Indonesia', value: 'id' },
        { label: 'ภาษาไทย', value: 'th' },
      ],
      defaultValue: 'zh',
    }),
    note: text({
      label: '備註',
      ui: { displayMode: 'textarea' },
    }),
    isEnabled: checkbox({
      label: '啟用',
      defaultValue: true,
    }),
  },
  ui: {
    label: 'RSS 關鍵字',
    listView: {
      initialColumns: ['keyword', 'language', 'isEnabled', 'note'],
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
