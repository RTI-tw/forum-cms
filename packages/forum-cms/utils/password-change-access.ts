import { getOperationAST, Kind, parse, FragmentDefinitionNode, SelectionSetNode } from 'graphql'

/** Restrict expired-password sessions to changing their own password and UI status. */
export function isPasswordChangeOperationAllowed(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const request = body as { query?: unknown; operationName?: unknown }
  if (typeof request.query !== 'string') return false
  if (request.operationName != null && typeof request.operationName !== 'string') return false
  try {
    const document = parse(request.query)
    const operation = getOperationAST(document, request.operationName as string | undefined)
    if (!operation) return false
    const allowed = operation.operation === 'mutation' ? new Set(['changeMyPassword', 'endSession', '__typename']) :
      operation.operation === 'query' ? new Set(['authenticatedItem', 'keystone', '__typename']) : new Set<string>()
    const fragments = new Map<string, FragmentDefinitionNode>()
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition)
    }
    function check(selections: SelectionSetNode, visiting = new Set<string>()): boolean {
      return selections.selections.every(selection => {
        if (selection.kind === Kind.FIELD) return allowed.has(selection.name.value)
        if (selection.kind === Kind.INLINE_FRAGMENT) return check(selection.selectionSet, visiting)
        const name = selection.name.value
        const fragment = fragments.get(name)
        if (!fragment || visiting.has(name)) return false
        return check(fragment.selectionSet, new Set([...visiting, name]))
      })
    }
    return check(operation.selectionSet)
  } catch { return false }
}
