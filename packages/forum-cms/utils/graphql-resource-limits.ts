import {
    GraphQLError,
    Kind,
    isListType,
    isNonNullType,
    type ASTVisitor,
    type FieldNode,
    type ValidationContext,
    type ValidationRule,
} from "graphql";

export type GraphqlResourceLimits = {
    maxDepth: number;
    maxFields: number;
    maxAliases: number;
    maxDuplicateFields: number;
    maxComplexity: number;
    defaultListMultiplier: number;
    maxListMultiplier: number;
};

export const DEFAULT_GRAPHQL_RESOURCE_LIMITS: GraphqlResourceLimits = {
    maxDepth: 12,
    maxFields: 300,
    maxAliases: 50,
    maxDuplicateFields: 5,
    maxComplexity: 5000,
    defaultListMultiplier: 10,
    maxListMultiplier: 100,
};

function unwrapList(type: ReturnType<ValidationContext["getType"]>): boolean {
    if (!type) return false;
    const nullable = isNonNullType(type) ? type.ofType : type;
    return isListType(nullable);
}

function getListMultiplier(
    node: FieldNode,
    limits: GraphqlResourceLimits,
): number {
    const paginationArgument = node.arguments?.find((argument) =>
        ["first", "last", "take", "limit"].includes(argument.name.value),
    );
    if (paginationArgument?.value.kind === Kind.INT) {
        const requested = Number.parseInt(paginationArgument.value.value, 10);
        if (Number.isFinite(requested)) {
            return Math.min(Math.max(requested, 1), limits.maxListMultiplier);
        }
    }
    return limits.defaultListMultiplier;
}

/**
 * Bounds work before Keystone's generated resolvers execute. The complexity
 * score deliberately favours predictable, conservative limits: fields become
 * more expensive with depth, while list fields also use a pagination multiplier.
 */
export function createGraphqlResourceLimitRule(
    overrides: Partial<GraphqlResourceLimits> = {},
): ValidationRule {
    const limits = { ...DEFAULT_GRAPHQL_RESOURCE_LIMITS, ...overrides };

    return (context: ValidationContext): ASTVisitor => {
        let depth = 0;
        let fields = 0;
        let aliases = 0;
        let complexity = 0;
        const responseNamesBySelectionSet: Array<Map<string, number>> = [];
        const reported = new Set<string>();

        const report = (kind: string, message: string, node: any) => {
            if (reported.has(kind)) return;
            reported.add(kind);
            context.reportError(
                new GraphQLError(message, {
                    nodes: node,
                    extensions: { code: "GRAPHQL_QUERY_LIMIT_EXCEEDED" },
                }),
            );
        };

        return {
            SelectionSet: {
                enter(node) {
                    depth += 1;
                    responseNamesBySelectionSet.push(new Map());
                    if (depth > limits.maxDepth) {
                        report(
                            "depth",
                            `GraphQL query depth exceeds the maximum of ${limits.maxDepth}`,
                            node,
                        );
                    }
                },
                leave() {
                    depth -= 1;
                    responseNamesBySelectionSet.pop();
                },
            },
            Field(node) {
                fields += 1;
                if (node.alias) aliases += 1;

                const responseName = node.alias?.value ?? node.name.value;
                const siblings = responseNamesBySelectionSet.at(-1);
                const duplicates = (siblings?.get(responseName) ?? 0) + 1;
                siblings?.set(responseName, duplicates);

                const listMultiplier = unwrapList(context.getType())
                    ? getListMultiplier(node, limits)
                    : 1;
                complexity += Math.max(depth, 1) * listMultiplier;

                if (fields > limits.maxFields) {
                    report(
                        "fields",
                        `GraphQL field count exceeds the maximum of ${limits.maxFields}`,
                        node,
                    );
                }
                if (aliases > limits.maxAliases) {
                    report(
                        "aliases",
                        `GraphQL alias count exceeds the maximum of ${limits.maxAliases}`,
                        node,
                    );
                }
                if (duplicates > limits.maxDuplicateFields) {
                    report(
                        "duplicates",
                        `GraphQL duplicate field count exceeds the maximum of ${limits.maxDuplicateFields}`,
                        node,
                    );
                }
                if (complexity > limits.maxComplexity) {
                    report(
                        "complexity",
                        `GraphQL query complexity exceeds the maximum of ${limits.maxComplexity}`,
                        node,
                    );
                }
            },
        };
    };
}
