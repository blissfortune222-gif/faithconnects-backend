"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageResolvers = void 0;
const Conversation_1 = require("../../models/Conversation");
const Message_1 = require("../../models/Message");
const User_1 = require("../../models/User");
const Notification_1 = require("../../models/Notification");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
const assertParticipant = (conv, userId) => {
    if (!conv)
        throw new Error('Conversation not found.');
    const ids = conv.participants.map((p) => String(p));
    if (!ids.includes(userId)) {
        throw new Error('Unauthorized: you are not a participant in this conversation.');
    }
};
exports.messageResolvers = {
    Message: {
        sender: (parent) => User_1.User.findById(parent.senderId),
        receiver: (parent) => User_1.User.findById(parent.receiverId),
    },
    Query: {
        messages: async (_, { conversationId, limit, offset }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(conversationId))
                throw new Error('Invalid conversation id.');
            const conv = await Conversation_1.Conversation.findById(conversationId);
            assertParticipant(conv, user.id);
            return Message_1.Message.find({ conversationId: (0, helpers_1.toObjectId)(conversationId) })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
        },
    },
    Mutation: {
        sendMessage: async (_, { conversationId, text }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!text.trim())
                throw new Error('Message text cannot be empty.');
            if (!(0, helpers_1.isValidId)(conversationId))
                throw new Error('Invalid conversation id.');
            const conv = await Conversation_1.Conversation.findById(conversationId);
            assertParticipant(conv, user.id);
            const receiverId = conv.participants.find((p) => String(p) !== user.id);
            if (!receiverId)
                throw new Error('Conversation has no recipient.');
            const message = await Message_1.Message.create({
                conversationId: (0, helpers_1.toObjectId)(conversationId),
                senderId: (0, helpers_1.toObjectId)(user.id),
                receiverId,
                text: text.trim(),
            });
            conv.lastMessage = text.trim();
            conv.lastMessageAt = new Date();
            await conv.save();
            await Notification_1.Notification.create({
                recipientId: receiverId,
                senderId: (0, helpers_1.toObjectId)(user.id),
                type: 'MESSAGE',
                referenceId: (0, helpers_1.toObjectId)(conversationId),
                message: 'sent you a message.',
            });
            return message;
        },
        markMessageAsRead: async (_, { messageId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(messageId))
                throw new Error('Invalid message id.');
            const message = await Message_1.Message.findById(messageId);
            if (!message)
                throw new Error('Message not found.');
            if (String(message.receiverId) !== user.id) {
                throw new Error('Unauthorized: only the recipient can mark a message as read.');
            }
            message.isRead = true;
            await message.save();
            return message;
        },
        markConversationAsRead: async (_, { conversationId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(conversationId))
                throw new Error('Invalid conversation id.');
            const conv = await Conversation_1.Conversation.findById(conversationId);
            assertParticipant(conv, user.id);
            await Message_1.Message.updateMany({
                conversationId: (0, helpers_1.toObjectId)(conversationId),
                receiverId: (0, helpers_1.toObjectId)(user.id),
                isRead: false,
            }, { isRead: true });
            return true;
        },
    },
};
//# sourceMappingURL=message.js.map