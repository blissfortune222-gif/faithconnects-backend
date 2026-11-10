"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followResolvers = void 0;
const Follow_1 = require("../../models/Follow");
const User_1 = require("../../models/User");
const Notification_1 = require("../../models/Notification");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
exports.followResolvers = {
    Query: {
        followers: async (_, { userId }, context) => {
            (0, auth_1.requireUser)(context);
            const edges = await Follow_1.Follow.find({ followingId: (0, helpers_1.toObjectId)(userId) })
                .populate('followerId')
                .sort({ createdAt: -1 });
            return edges.map((e) => e.followerId).filter(Boolean);
        },
        following: async (_, { userId }, context) => {
            (0, auth_1.requireUser)(context);
            const edges = await Follow_1.Follow.find({ followerId: (0, helpers_1.toObjectId)(userId) })
                .populate('followingId')
                .sort({ createdAt: -1 });
            return edges.map((e) => e.followingId).filter(Boolean);
        },
        isFollowing: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            return (0, helpers_1.isFollowing)(user.id, userId);
        },
    },
    Mutation: {
        followUser: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (user.id === userId)
                throw new Error('You cannot follow yourself.');
            const target = await User_1.User.findById((0, helpers_1.toObjectId)(userId));
            if (!target)
                throw new Error('User not found.');
            const existing = await Follow_1.Follow.findOne({
                followerId: (0, helpers_1.toObjectId)(user.id),
                followingId: (0, helpers_1.toObjectId)(userId),
            });
            if (existing)
                throw new Error('You are already following this user.');
            await Follow_1.Follow.create({
                followerId: (0, helpers_1.toObjectId)(user.id),
                followingId: (0, helpers_1.toObjectId)(userId),
            });
            await Notification_1.Notification.create({
                recipientId: (0, helpers_1.toObjectId)(userId),
                senderId: (0, helpers_1.toObjectId)(user.id),
                type: 'FOLLOW',
                referenceId: (0, helpers_1.toObjectId)(user.id),
                message: 'started following you.',
            });
            return target;
        },
        unfollowUser: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (user.id === userId)
                throw new Error('You cannot unfollow yourself.');
            const target = await User_1.User.findById((0, helpers_1.toObjectId)(userId));
            if (!target)
                throw new Error('User not found.');
            await Follow_1.Follow.deleteOne({
                followerId: (0, helpers_1.toObjectId)(user.id),
                followingId: (0, helpers_1.toObjectId)(userId),
            });
            return target;
        },
    },
};
//# sourceMappingURL=follow.js.map