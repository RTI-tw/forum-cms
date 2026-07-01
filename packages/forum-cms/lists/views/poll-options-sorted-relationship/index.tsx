/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core'
import {
  FieldContainer,
  FieldDescription,
  FieldLegend,
} from '@keystone-ui/fields'
import { useList } from '@keystone-6/core/admin-ui/context'
import type { FieldProps } from '@keystone-6/core/types'

import {
  CardValue,
  Cell,
  Field as RelationshipField,
  controller,
} from '../sorted-relationship'
import { Cards } from '../sorted-relationship/cards'

const POLL_OPTION_RELATIONSHIP_ORDER_BY = '[{ sortOrder: asc }, { id: asc }]'

export const Field = (props: FieldProps<typeof controller>) => {
  const { field, value, onChange, forceValidation } = props
  const foreignList = useList(field.refListKey)
  const localList = useList(field.listKey)

  if (value.kind !== 'cards-view') {
    return <RelationshipField {...props} />
  }

  return (
    <FieldContainer as="fieldset">
      <FieldLegend>{field.label}</FieldLegend>
      <FieldDescription id={`${field.path}-description`}>
        {field.description}
      </FieldDescription>
      <Cards
        forceValidation={forceValidation}
        field={field}
        id={value.id}
        value={value}
        onChange={onChange}
        foreignList={foreignList}
        localList={localList}
        relationshipOrderBy={POLL_OPTION_RELATIONSHIP_ORDER_BY}
        relationshipSortField="sortOrder"
      />
    </FieldContainer>
  )
}

export { CardValue, Cell, controller }
