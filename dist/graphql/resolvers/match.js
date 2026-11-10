"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchResolvers = void 0;
const Match_1 = require("../../models/Match");
const ProfileLike_1 = require("../../models/ProfileLike");
const User_1 = require("../../models/User");
const Conversation_1 = require("../../models/Conversation");
const Notification_1 = require("../../models/Notification");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
exports.matchResolvers = {
    Match: {
        user1: (parent) => User_1.User.findById(parent.user1),
        user2: (parent) => User_1.User.findById(parent.user2),
        conversation: (parent) => parent.conversationId ? Conversation_1.Conversation.findById(parent.conversationId) : null,
    },
    Query: {
        matches: async (_, __, context) => {
            const user = (0, auth_1.requireUser)(context);
            const uid = (0, helpers_1.toObjectId)(user.id);
            return Match_1.Match.find({ $or: [{ user1: uid }, { user2: uid }] }).sort({ matchedAt: -1 });
        },
    },
    Mutation: {
        likeProfile: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (user.id === userId)
                throw new Error('You cannot like your own profile.');
            if (!(0, helpers_1.isValidId)(userId))
                throw new Error('Invalid user id.');
            const target = await User_1.User.findById((0, helpers_1.toObjectId)(userId));
            if (!target)
                throw new Error('User not found.');
            // Record the current user's "like" decision (idempotent-ish: upsert action).
            await ProfileLike_1.ProfileLike.findOneAndUpdate({ fromUserId: (0, helpers_1.toObjectId)(user.id), toUserId: (0, helpers_1.toObjectId)(userId) }, { action: 'like' }, { upsert: true, new: true });
            // Check whether the target already liked the current user.
            const reciprocal = await ProfileLike_1.ProfileLike.findOne({
                fromUserId: (0, helpers_1.toObjectId)(userId),
                toUserId: (0, helpers_1.toObjectId)(user.id),
                action: 'like',
            });
            if (!reciprocal) {
                return { matched: false, match: null };
            }
            // Create a unique match (canonical order: lower id first).
            const [a, b] = [(0, helpers_1.toObjectId)(user.id), (0, helpers_1.toObjectId)(userId)].sort((x, y) => String(x) < String(y) ? -1 : 1);
            let match = await Match_1.Match.findOne({ user1: a, user2: b });
            if (!match) {
                const conversation = await Conversation_1.Conversation.create({
                    participants: [a, b],
                });
                match = await Match_1.Match.create({
                    user1: a,
                    user2: b,
                    conversationId: conversation._id,
                });
                await Notification_1.Notification.create({
                    recipientId: a,
                    senderId: b,
                    type: 'MATCH',
                    referenceId: match._id,
                    message: 'You have a new match!',
                });
                await Notification_1.Notification.create({
                    recipientId: b,
                    senderId: a,
                    type: 'MATCH',
                    referenceId: match._id,
                    message: 'You have a new match!',
                });
            }
            return { matched: true, match };
        },
        passProfile: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (user.id === userId)
                throw new Error('You cannot pass your own profile.');
            if (!(0, helpers_1.isValidId)(userId))
                throw new Error('Invalid user id.');
            await ProfileLike_1.ProfileLike.findOneAndUpdate({ fromUserId: (0, helpers_1.toObjectId)(user.id), toUserId: (0, helpers_1.toObjectId)(userId) }, { action: 'pass' }, { upsert: true, new: true });
            return true;
        },
        removeMatch: async (_, { matchId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(matchId))
                throw new Error('Invalid match id.');
            const match = await Match_1.Match.findById(matchId);
            if (!match)
                throw new Error('Match not found.');
            const uid = String((0, helpers_1.toObjectId)(user.id));
            if (String(match.user1) !== uid && String(match.user2) !== uid) {
                throw new Error('Unauthorized: you can only remove your own matches.');
            }
            await match.deleteOne();
            return true;
        },
    },
};
//# sourceMappingURL=match.js.map