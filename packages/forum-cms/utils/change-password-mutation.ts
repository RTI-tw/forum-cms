// This file documents the GraphQL mutation users should use to change password
// when mustChangePassword is true

// Mutation:
// mutation ChangePassword($id: ID!, $password: String!) {
//   updateUser(where: { id: $id }, data: { password: $password, mustChangePassword: false }) {
//     id
//     mustChangePassword
//   }
// }

// Users can call this via GraphQL Playground or any GraphQL client
// After successful mutation, they can log in again and access Admin UI

