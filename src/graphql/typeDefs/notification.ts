export const notificationTypes = /* GraphQL */ `
  type Notification {
    id: ID!
    recipient: User!
    sender: User!
    type: String!
    referenceId: ID
    message: String!
    isRead: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  extend type Query {
    notifications(limit: Int = 20, offset: Int = 0): [Notification!]!
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: Boolean!
  }
`;
