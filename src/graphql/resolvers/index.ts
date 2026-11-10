// ```ts
import { userResolvers } from "./user";
import { followResolvers } from "./follow";
import { postResolvers } from "./post";
import { matchResolvers } from "./match";
import { conversationResolvers } from "./conversation";
import { messageResolvers } from "./message";
import { notificationResolvers } from "./notification";

export const resolvers = {
  User: {
    ...userResolvers.User,
  },

  Post: {
    ...postResolvers.Post,
  },

  // ✅ THIS WAS MISSING
  Comment: {
    ...postResolvers.Comment,
  },

  Match: {
    ...matchResolvers.Match,
  },

  Conversation: {
    ...conversationResolvers.Conversation,
  },

  Message: {
    ...messageResolvers.Message,
  },

  Notification: {
    ...notificationResolvers.Notification,
  },

  Query: {
    ...userResolvers.Query,
    ...followResolvers.Query,
    ...postResolvers.Query,
    ...matchResolvers.Query,
    ...conversationResolvers.Query,
    ...messageResolvers.Query,
    ...notificationResolvers.Query,
  },

  Mutation: {
    ...userResolvers.Mutation,
    ...followResolvers.Mutation,
    ...postResolvers.Mutation,
    ...matchResolvers.Mutation,
    ...conversationResolvers.Mutation,
    ...messageResolvers.Mutation,
    ...notificationResolvers.Mutation,
  },
};
