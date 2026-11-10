"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchTypes = void 0;
exports.matchTypes = `
  type Match {
    id: ID!
    user1: User!
    user2: User!
    matchedAt: DateTime!
    conversationId: ID
    conversation: Conversation
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    matches: [Match!]!
  }

  extend type Mutation {
    likeProfile(userId: ID!): MatchProfileResult!
    passProfile(userId: ID!): Boolean!
    removeMatch(matchId: ID!): Boolean!
  }

  type MatchProfileResult {
    matched: Boolean!
    match: Match
  }
`;
//# sourceMappingURL=match.js.map