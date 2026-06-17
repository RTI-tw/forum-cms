import type { FieldProps } from '@keystone-6/core/types'
import {
  CardValue,
  Cell,
  controller,
  Field as FileField,
} from '@keystone-6/core/fields/types/file/views'
import { isAdFormatFieldVisible } from './helpers'

export { CardValue, Cell, controller }

export function Field(props: FieldProps<typeof controller>) {
  if (!isAdFormatFieldVisible(props.field.path, props.itemValue)) {
    return null
  }

  return <FileField {...props} />
}
