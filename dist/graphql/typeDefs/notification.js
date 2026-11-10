"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationTypes = void 0;
exports.notificationTypes = `
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
//# sourceMappingURL=notification.js.map