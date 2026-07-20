import assert from "assert";
import { buildSchema, parse, validate } from "graphql";
import { createGraphqlResourceLimitRule } from "./graphql-resource-limits";

const schema = buildSchema(`
    type Item { id: ID!, children(first: Int): [Item!]! }
    type Query { item: Item, items(take: Int): [Item!]! }
`);

function errors(query: string, limits: Parameters<typeof createGraphqlResourceLimitRule>[0]) {
    return validate(schema, parse(query), [createGraphqlResourceLimitRule(limits)]);
}

assert.equal(errors("query { item { id } }", {}).length, 0);

assert.match(
    errors("query { item { children { children { id } } } }", { maxDepth: 3 })[0].message,
    /depth/,
);

assert.match(
    errors("query { a: item { id } b: item { id } }", { maxAliases: 1 })[0].message,
    /alias/,
);

assert.match(
    errors("query { item item item }", { maxDuplicateFields: 2 })[0].message,
    /duplicate/,
);

assert.match(
    errors("query { items(take: 100) { id } }", { maxComplexity: 50 })[0].message,
    /complexity/,
);

assert.equal(
    errors("query { item { id } }", { maxFields: 1 })[0].extensions.code,
    "GRAPHQL_QUERY_LIMIT_EXCEEDED",
);

console.log("graphql-resource-limits.test.ts: all assertions passed");

