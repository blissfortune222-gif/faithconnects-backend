import { Conversation, IConversation } from '../../models/Conversation';
import { Message, IMessage } from '../../models/Message';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { requireUser } from '../../middleware/auth';
import { toObjectId, isValidId } from './helpers';

const assertParticipant = (conv: IConversation | null, userId: string) => {
  if (!conv) throw new Error('Conversation not found.');
  const ids = conv.participants.map((p) => String(p));
  if (!ids.includes(userId)) {
    throw new Error('Unauthorized: you are not a participant in this conversation.');
  }
};

export const messageResolvers = {
  Message: {
    sender: (parent: IMessage) => User.findById(parent.senderId),
    receiver: (parent: IMessage) => User.findById(parent.receiverId),
  },

  Query: {
    messages: async (
      _: any,
      { conversationId, limit, offset }: { conversationId: string; limit: number; offset: number },
      context: any
    ) => {
      const user = requireUser(context);
      if (!isValidId(conversationId)) throw new Error('Invalid conversation id.');
      const conv = await Conversation.findById(conversationId);
      assertParticipant(conv, user.id);
      return Message.find({ conversationId: toObjectId(conversationId) })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
    },
  },

  Mutation: {
    sendMessage: async (
      _: any,
      { conversationId, text }: { conversationId: string; text: string },
      context: any
    ) => {
      const user = requireUser(context);
      if (!text.trim()) throw new Error('Message text cannot be empty.');
      if (!isValidId(conversationId)) throw new Error('Invalid conversation id.');
      const conv = await Conversation.findById(conversationId);
      assertParticipant(conv, user.id);

      const receiverId = conv!.participants.find((p) => String(p) !== user.id);
      if (!receiverId) throw new Error('Conversation has no recipient.');

      const message = await Message.create({
        conversationId: toObjectId(conversationId),
        senderId: toObjectId(user.id),
        receiverId,
        text: text.trim(),
      });

      conv!.lastMessage = text.trim();
      conv!.lastMessageAt = new Date();
      await conv!.save();

      await Notification.create({
        recipientId: receiverId,
        senderId: toObjectId(user.id),
        type: 'MESSAGE',
        referenceId: toObjectId(conversationId),
        message: 'sent you a message.',
      });

      return message;
    },

    markMessageAsRead: async (_: any, { messageId }: { messageId: string }, context: any) => {
      const user = requireUser(context);
      if (!isValidId(messageId)) throw new Error('Invalid message id.');
      const message = await Message.findById(messageId);
      if (!message) throw new Error('Message not found.');
      if (String(message.receiverId) !== user.id) {
        throw new Error('Unauthorized: only the recipient can mark a message as read.');
      }
      message.isRead = true;
      await message.save();
      return message;
    },

    markConversationAsRead: async (
      _: any,
      { conversationId }: { conversationId: string },
      context: any
    ) => {
      const user = requireUser(context);
      if (!isValidId(conversationId)) throw new Error('Invalid conversation id.');
      const conv = await Conversation.findById(conversationId);
      assertParticipant(conv, user.id);
      await Message.updateMany(
        {
          conversationId: toObjectId(conversationId),
          receiverId: toObjectId(user.id),
          isRead: false,
        },
        { isRead: true }
      );
      return true;
    },
  },
};
