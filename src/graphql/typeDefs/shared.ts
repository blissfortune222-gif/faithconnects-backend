export const sharedTypes = /* GraphQL */ `
  scalar DateTime

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PrivacySettings {
    profileVisibility: String!
    showOnlineStatus: Boolean!
    allowMessagesFrom: String!
    showAge: Boolean!
  }

  type AppearanceSettings {
    theme: String!
    accentColor: String!
  }

  type CompatibilityInfo {
    score: Int!
    sharedInterests: [String!]!
  }

  type PaginatedPosts {
    posts: [Post!]!
    total: Int!
  }

  type PaginatedUsers {
    users: [User!]!
    total: Int!
  }
`;
