"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationTypes = void 0;
exports.conversationTypes = `
  type Conversation {
    id: ID!
    participants: [User!]!
    lastMessage: String
    lastMessageAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }
`;
//# sourceMappingURL=conversation.js.map