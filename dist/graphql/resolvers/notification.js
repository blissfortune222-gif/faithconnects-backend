"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationResolvers = void 0;
const Notification_1 = require("../../models/Notification");
const User_1 = require("../../models/User");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
exports.notificationResolvers = {
    Notification: {
        recipient: (parent) => User_1.User.findById(parent.recipientId),
        sender: (parent) => User_1.User.findById(parent.senderId),
    },
    Query: {
        notifications: async (_, { limit, offset }, context) => {
            const user = (0, auth_1.requireUser)(context);
            return Notification_1.Notification.find({ recipientId: (0, helpers_1.toObjectId)(user.id) })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
        },
        unreadNotificationCount: async (_, __, context) => {
            const user = (0, auth_1.requireUser)(context);
            return Notification_1.Notification.countDocuments({
                recipientId: (0, helpers_1.toObjectId)(user.id),
                isRead: false,
            });
        },
    },
    Mutation: {
        markNotificationAsRead: async (_, { id }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(id))
                throw new Error('Invalid notification id.');
            const notif = await Notification_1.Notification.findById(id);
            if (!notif)
                throw new Error('Notification not found.');
            if (String(notif.recipientId) !== user.id) {
                throw new Error('Unauthorized: you can only manage your own notifications.');
            }
            notif.isRead = true;
            await notif.save();
            return notif;
        },
        markAllNotificationsAsRead: async (_, __, context) => {
            const user = (0, auth_1.requireUser)(context);
            await Notification_1.Notification.updateMany({ recipientId: (0, helpers_1.toObjectId)(user.id), isRead: false }, { isRead: true });
            return true;
        },
    },
};
//# sourceMappingURL=notification.js.map