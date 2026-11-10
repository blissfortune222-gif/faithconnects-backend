"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationResolvers = void 0;
const Conversation_1 = require("../../models/Conversation");
const User_1 = require("../../models/User");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
exports.conversationResolvers = {
    Conversation: {
        participants: (parent) => User_1.User.find({ _id: { $in: parent.participants } }),
    },
    Query: {
        conversations: async (_, __, context) => {
            const user = (0, auth_1.requireUser)(context);
            return Conversation_1.Conversation.find({ participants: (0, helpers_1.toObjectId)(user.id) }).sort({
                lastMessageAt: -1,
            });
        },
        conversation: async (_, { id }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(id))
                throw new Error('Invalid conversation id.');
            const conv = await Conversation_1.Conversation.findById(id);
            if (!conv)
                throw new Error('Conversation not found.');
            const ids = conv.participants.map((p) => String(p));
            if (!ids.includes(user.id)) {
                throw new Error('Unauthorized: you are not a participant in this conversation.');
            }
            return conv;
        },
    },
    Mutation: {
        createConversation: async (_, { userId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (user.id === userId)
                throw new Error('You cannot start a conversation with yourself.');
            if (!(0, helpers_1.isValidId)(userId))
                throw new Error('Invalid user id.');
            const target = await User_1.User.findById((0, helpers_1.toObjectId)(userId));
            if (!target)
                throw new Error('User not found.');
            const participants = [(0, helpers_1.toObjectId)(user.id), (0, helpers_1.toObjectId)(userId)].sort((x, y) => String(x) < String(y) ? -1 : 1);
            let conv = await Conversation_1.Conversation.findOne({
                participants: { $all: participants, $size: 2 },
            });
            if (!conv) {
                conv = await Conversation_1.Conversation.create({ participants });
            }
            return conv;
        },
    },
};
//# sourceMappingURL=conversation.js.map