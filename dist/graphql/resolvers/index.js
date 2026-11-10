"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const user_1 = require("./user");
const follow_1 = require("./follow");
const post_1 = require("./post");
const match_1 = require("./match");
const conversation_1 = require("./conversation");
const message_1 = require("./message");
const notification_1 = require("./notification");
exports.resolvers = {
    User: {
        ...user_1.userResolvers.User,
    },
    Post: {
        ...post_1.postResolvers.Post,
    },
    Match: {
        ...match_1.matchResolvers.Match,
    },
    Conversation: {
        ...conversation_1.conversationResolvers.Conversation,
    },
    Message: {
        ...message_1.messageResolvers.Message,
    },
    Notification: {
        ...notification_1.notificationResolvers.Notification,
    },
    Query: {
        ...user_1.userResolvers.Query,
        ...follow_1.followResolvers.Query,
        ...post_1.postResolvers.Query,
        ...match_1.matchResolvers.Query,
        ...conversation_1.conversationResolvers.Query,
        ...message_1.messageResolvers.Query,
        ...notification_1.notificationResolvers.Query,
    },
    Mutation: {
        ...user_1.userResolvers.Mutation,
        ...follow_1.followResolvers.Mutation,
        ...post_1.postResolvers.Mutation,
        ...match_1.matchResolvers.Mutation,
        ...conversation_1.conversationResolvers.Mutation,
        ...message_1.messageResolvers.Mutation,
        ...notification_1.notificationResolvers.Mutation,
    },
};
//# sourceMappingURL=index.js.map