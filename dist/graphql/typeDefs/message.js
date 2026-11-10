"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageTypes = void 0;
exports.messageTypes = `
  type Message {
    id: ID!
    conversationId: ID!
    sender: User!
    receiver: User!
    senderId: ID!
    receiverId: ID!
    text: String!
    isRead: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    conversations: [Conversation!]!
    conversation(id: ID!): Conversation
    messages(conversationId: ID!, limit: Int = 50, offset: Int = 0): [Message!]!
  }

  extend type Mutation {
    createConversation(userId: ID!): Conversation!
    sendMessage(conversationId: ID!, text: String!): Message!
    markMessageAsRead(messageId: ID!): Message!
    markConversationAsRead(conversationId: ID!): Boolean!
  }
`;
//# sourceMappingURL=message.js.map