/** @jsxRuntime classic */
/** @jsx jsx */

import 'intersection-observer'
import {
  type RefObject,
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
  useRef,
} from 'react'

import { jsx } from '@keystone-ui/core'
import { MultiSelect, Select, selectComponents } from '@keystone-ui/fields'
import { type ListMeta } from '@keystone-6/core/types'
import {
  type TypedDocumentNode,
  ApolloClient,
  gql,
  InMemoryCache,
  useApolloClient,
  useQuery,
} from '@keystone-6/core/admin-ui/apollo'
import { useKeystone } from '@keystone-6/core/admin-ui/context'

import { mergeRelationshipWhere } from './mergeRelationshipWhere'

function useIntersectionObserver(
  cb: IntersectionObserverCallback,
  ref: RefObject<any>
) {
  const cbRef = useRef(cb)
  useEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    const observer = new IntersectionObserver(
      (...args) => cbRef.current(...args),
      {}
    )
    const node = ref.current
    if (node !== null) {
      observer.observe(node)
      return () => observer.unobserve(node)
    }
  }, [ref])
}

function useDebouncedValue<T>(value: T, limitMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(() => value)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(() => value)
    }, limitMs)
    return () => clearTimeout(timeout)
  }, [value, limitMs])

  return debouncedValue
}

function isInt(x: string) {
  return Number.isInteger(Number(x))
}

function isBigInt(x: string) {
  try {
    BigInt(x)
    return true
  } catch {
    return true
  }
}

function isUuid(x: unknown) {
  if (typeof x !== 'string') return
  if (x.length !== 36) return
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

function useSearchFilter(
  value: string,
  list: ListMeta,
  searchFields: string[],
  lists: Record<string, ListMeta>
) {
  return useMemo(() => {
    const trimmedSearch = value.trim()
    if (!trimmedSearch.length) return { OR: [] }

    const conditions: Record<string, any>[] = []
    const idField = list.fields.id.fieldMeta as { type: string; kind: string }

    if (idField.type === 'String') {
      if (idField.kind === 'uuid') {
        if (isUuid(value)) {
          conditions.push({ id: { equals: trimmedSearch } })
        }
      } else {
        conditions.push({ id: { equals: trimmedSearch } })
      }
    } else if (idField.type === 'Int' && isInt(trimmedSearch)) {
      conditions.push({ id: { equals: Number(trimmedSearch) } })
    } else if (idField.type === 'BigInt' && isBigInt(trimmedSearch)) {
      conditions.push({ id: { equals: trimmedSearch } })
    }

    for (const fieldKey of searchFields) {
      const field = list.fields[fieldKey]

      if ((field.fieldMeta as any)?.refSearchFields) {
        const {
          refListKey,
          refSearchFields,
          many = false,
        } = field.fieldMeta as any
        const refList = lists[refListKey]

        for (const refFieldKey of refSearchFields) {
          const refField = refList.fields[refFieldKey]
          if (!refField.search) continue

          if (many) {
            conditions.push({
              [fieldKey]: {
                some: {
                  [refFieldKey]: {
                    contains: trimmedSearch,
                    mode:
                      refField.search === 'insensitive' ? 'insensitive' : undefined,
                  },
                },
              },
            })

            continue
          }

          conditions.push({
            [fieldKey]: {
              [refFieldKey]: {
                contains: trimmedSearch,
                mode:
                  refField.search === 'insensitive' ? 'insensitive' : undefined,
              },
            },
          })
        }

        continue
      }

      conditions.push({
        [field.path]: {
          contains: trimmedSearch,
          mode: field.search === 'insensitive' ? 'insensitive' : undefined,
        },
      })
    }

    return { OR: conditions }
  }, [value, list, searchFields, lists])
}

const idFieldAlias = '____id____'
const labelFieldAlias = '____label____'

const LoadingIndicatorContext = createContext<{
  count: number
  ref: (element: HTMLElement | null) => void
}>({
  count: 0,
  ref: () => {},
})

export function FilteredRelationshipSelect({
  autoFocus,
  controlShouldRenderValue,
  isDisabled,
  isLoading,
  labelField,
  searchFields,
  list,
  placeholder,
  portalMenu,
  state,
  extraSelection = '',
  baseWhere,
}: {
  autoFocus?: boolean
  controlShouldRenderValue: boolean
  isDisabled: boolean
  isLoading?: boolean
  labelField: string
  searchFields: string[]
  list: ListMeta
  placeholder?: string
  portalMenu?: true | undefined
  state:
    | {
        kind: 'many'
        value: { label: string; id: string; data?: Record<string, any> }[]
        onChange(value: {
          label: string
          id: string
          data: Record<string, any>
        }[]): void
      }
    | {
        kind: 'one'
        value: { label: string; id: string; data?: Record<string, any> } | null
        onChange(
          value: { label: string; id: string; data: Record<string, any> } | null
        ): void
      }
  extraSelection?: string
  baseWhere: Record<string, unknown>
}) {
  const keystone = useKeystone()
  const [search, setSearch] = useState('')
  const [loadingIndicatorElement, setLoadingIndicatorElement] =
    useState<null | HTMLElement>(null)

  const QUERY: TypedDocumentNode<
    {
      items: {
        [idFieldAlias]: string
        [labelFieldAlias]: string | null
      }[]
      count: number
    },
    { where: Record<string, any>; take: number; skip: number }
  > = gql`
    query FilteredRelationshipSelect($where: ${list.gqlNames.whereInputName}!, $take: Int!, $skip: Int!) {
      items: ${list.gqlNames.listQueryName}(where: $where, take: $take, skip: $skip) {
        ${idFieldAlias}: id
        ${labelFieldAlias}: ${labelField}
        ${extraSelection}
      }
      count: ${list.gqlNames.listQueryCountName}(where: $where)
    }
  `

  const debouncedSearch = useDebouncedValue(search, 200)
  const searchWhere = useSearchFilter(
    debouncedSearch,
    list,
    searchFields,
    keystone.adminMeta.lists
  )
  const where = useMemo(
    () => mergeRelationshipWhere(baseWhere, searchWhere),
    [baseWhere, searchWhere]
  )

  const link = useApolloClient().link
  const apolloClient = useMemo(
    () =>
      new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                [list.gqlNames.listQueryName]: {
                  keyArgs: ['where'],
                  merge: (
                    existing: readonly unknown[],
                    incoming: readonly unknown[],
                    { args }
                  ) => {
                    const merged = existing ? existing.slice() : []
                    const { skip } = args!
                    for (let i = 0; i < incoming.length; ++i) {
                      merged[skip + i] = incoming[i]
                    }
                    return merged
                  },
                },
              },
            },
          },
        }),
      }),
    [link, list.gqlNames.listQueryName]
  )

  // Keep relationship dropdowns predictable regardless of list.pageSize.
  // A small pageSize can otherwise hide valid options until infinite scroll fires.
  const initialItemsToLoad = 50
  const subsequentItemsToLoad = 50
  const { data, error, loading, fetchMore } = useQuery(QUERY, {
    fetchPolicy: 'network-only',
    variables: { where, take: initialItemsToLoad, skip: 0 },
    client: apolloClient,
  })

  const count = data?.count || 0

  const options =
    data?.items?.map(
      ({ [idFieldAlias]: value, [labelFieldAlias]: label, ...data }) => ({
        value,
        label: label || value,
        data,
      })
    ) || []

  const loadingIndicatorContextVal = useMemo(
    () => ({
      count,
      ref: setLoadingIndicatorElement,
    }),
    [count]
  )

  const [lastFetchMore, setLastFetchMore] = useState<{
    where: Record<string, any>
    extraSelection: string
    list: ListMeta
    skip: number
  } | null>(null)

  useIntersectionObserver(
    ([{ isIntersecting }]) => {
      const skip = data?.items.length
      if (
        !loading &&
        skip &&
        isIntersecting &&
        options.length < count &&
        (lastFetchMore?.extraSelection !== extraSelection ||
          lastFetchMore?.where !== where ||
          lastFetchMore?.list !== list ||
          lastFetchMore?.skip !== skip)
      ) {
        const MORE: TypedDocumentNode<
          {
            items: {
              [idFieldAlias]: string
              [labelFieldAlias]: string | null
            }[]
          },
          { where: Record<string, any>; take: number; skip: number }
        > = gql`
          query FilteredRelationshipSelectMore($where: ${list.gqlNames.whereInputName}!, $take: Int!, $skip: Int!) {
            items: ${list.gqlNames.listQueryName}(where: $where, take: $take, skip: $skip) {
              ${labelFieldAlias}: ${labelField}
              ${idFieldAlias}: id
              ${extraSelection}
            }
          }
        `

        setLastFetchMore({ extraSelection, list, skip, where })
        fetchMore({
          query: MORE,
          variables: {
            where,
            take: subsequentItemsToLoad,
            skip,
          },
        })
          .then(() => {
            setLastFetchMore(null)
          })
          .catch(() => {
            setLastFetchMore(null)
          })
      }
    },
    { current: loadingIndicatorElement }
  )

  if (error) {
    return <span>Error</span>
  }

  if (state.kind === 'one') {
    return (
      <LoadingIndicatorContext.Provider value={loadingIndicatorContextVal}>
        <Select
          onInputChange={(val) => setSearch(val)}
          isLoading={loading || isLoading}
          autoFocus={autoFocus}
          components={relationshipSelectComponents}
          portalMenu={portalMenu}
          value={
            state.value
              ? ({
                  value: state.value.id,
                  label: state.value.label,
                  data: state.value.data,
                } as any)
              : null
          }
          options={options}
          onChange={(value) => {
            state.onChange(
              value
                ? {
                    id: value.value,
                    label: value.label,
                    data: (value as any).data,
                  }
                : null
            )
          }}
          placeholder={placeholder}
          controlShouldRenderValue={controlShouldRenderValue}
          isClearable={controlShouldRenderValue}
          isDisabled={isDisabled}
        />
      </LoadingIndicatorContext.Provider>
    )
  }

  return (
    <LoadingIndicatorContext.Provider value={loadingIndicatorContextVal}>
      <MultiSelect
        onInputChange={(val) => setSearch(val)}
        isLoading={loading || isLoading}
        autoFocus={autoFocus}
        components={relationshipSelectComponents}
        portalMenu={portalMenu}
        value={state.value.map((value) => ({
          value: value.id,
          label: value.label,
          data: value.data,
        }))}
        options={options}
        onChange={(value) => {
          state.onChange(
            value.map((x) => ({
              id: x.value,
              label: x.label,
              data: (x as any).data,
            }))
          )
        }}
        placeholder={placeholder}
        controlShouldRenderValue={controlShouldRenderValue}
        isClearable={controlShouldRenderValue}
        isDisabled={isDisabled}
      />
    </LoadingIndicatorContext.Provider>
  )
}

const relationshipSelectComponents: Partial<typeof selectComponents> = {
  MenuList: ({ children, ...props }) => {
    const { count, ref } = useContext(LoadingIndicatorContext)
    return (
      <selectComponents.MenuList {...props}>
        {children}
        <div style={{ textAlign: 'center' }} ref={ref}>
          {props.options.length < count && (
            <span style={{ padding: 8 }}>Loading...</span>
          )}
        </div>
      </selectComponents.MenuList>
    )
  },
}
