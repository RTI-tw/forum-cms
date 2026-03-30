export {
  Cell,
  CardValue,
  controller,
} from '@keystone-6/core/fields/types/relationship/views'
import { createPostRelationshipField } from '../post-relationship-filter/PostRelationshipField'

export const Field = createPostRelationshipField({
  isEditorChoice: { equals: true },
})
