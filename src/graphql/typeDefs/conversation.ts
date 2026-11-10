export const conversationTypes = /* GraphQL */ `
  type Conversation {
    id: ID!
    participants: [User!]!
    lastMessage: String
    lastMessageAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }
`;
