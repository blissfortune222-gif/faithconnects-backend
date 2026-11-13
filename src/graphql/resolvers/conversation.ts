import { Conversation, IConversation } from "../../models/Conversation";
import { User } from "../../models/User";
import { requireUser } from "../../middleware/auth";
import { toObjectId, isValidId } from "./helpers";

export const conversationResolvers = {
  Conversation: {
    participants: async (parent: IConversation) => {
      return await User.find({
        _id: { $in: parent.participants },
      }).exec();
    },
  },

  Query: {
    conversations: async (_: any, __: any, context: any) => {
      const user = requireUser(context);

      return Conversation.find({
        participants: toObjectId(user.id),
      })
        .sort({ lastMessageAt: -1 })
        .exec();
    },

    conversation: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireUser(context);

      if (!isValidId(id)) {
        throw new Error("Invalid conversation id.");
      }

      const conv = await Conversation.findById(id).exec();

      if (!conv) {
        throw new Error("Conversation not found.");
      }

      const ids = conv.participants.map((p) => String(p));

      if (!ids.includes(user.id)) {
        throw new Error(
          "Unauthorized: you are not a participant in this conversation.",
        );
      }

      return conv;
    },
  },

  Mutation: {
    createConversation: async (
      _: any,
      { userId }: { userId: string },
      context: any,
    ) => {
      const user = requireUser(context);

      if (user.id === userId) {
        throw new Error("You cannot start a conversation with yourself.");
      }

      if (!isValidId(userId)) {
        throw new Error("Invalid user id.");
      }

      const target = await User.findById(toObjectId(userId));

      if (!target) {
        throw new Error("User not found.");
      }

      const participants = [toObjectId(user.id), toObjectId(userId)].sort(
        (x, y) => (String(x) < String(y) ? -1 : 1),
      );

      let conv = await Conversation.findOne({
        participants: { $all: participants, $size: 2 },
      }).exec();

      if (!conv) {
        conv = await Conversation.create({ participants });
      }

      return conv;
    },
  },
};
