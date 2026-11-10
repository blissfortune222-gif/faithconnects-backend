export const messageTypes = /* GraphQL */ `
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
