"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followTypes = void 0;
exports.followTypes = `
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
//# sourceMappingURL=follow.js.map