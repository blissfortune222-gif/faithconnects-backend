export const followTypes = /* GraphQL */ `
  type FollowEdge {
    follower: User!
    following: User!
    createdAt: DateTime!
  }

  extend type Query {
    followers(userId: ID!): [User!]!
    following(userId: ID!): [User!]!
    isFollowing(userId: ID!): Boolean!
  }

  extend type Mutation {
    followUser(userId: ID!): User!
    unfollowUser(userId: ID!): User!
  }
`;
