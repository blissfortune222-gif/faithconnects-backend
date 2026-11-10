import { Match } from '../../models/Match';
import { ProfileLike } from '../../models/ProfileLike';
import { User } from '../../models/User';
import { Conversation } from '../../models/Conversation';
import { Notification } from '../../models/Notification';
import { requireUser } from '../../middleware/auth';
import { toObjectId, isValidId } from './helpers';

export const matchResolvers = {
  Match: {
    user1: (parent: any) => User.findById(parent.user1),
    user2: (parent: any) => User.findById(parent.user2),
    conversation: (parent: any) =>
      parent.conversationId ? Conversation.findById(parent.conversationId) : null,
  },

  Query: {
    matches: async (_: any, __: any, context: any) => {
      const user = requireUser(context);
      const uid = toObjectId(user.id);
      return Match.find({ $or: [{ user1: uid }, { user2: uid }] }).sort({ matchedAt: -1 });
    },
  },

  Mutation: {
    likeProfile: async (_: any, { userId }: { userId: string }, context: any) => {
      const user = requireUser(context);
      if (user.id === userId) throw new Error('You cannot like your own profile.');
      if (!isValidId(userId)) throw new Error('Invalid user id.');
      const target = await User.findById(toObjectId(userId));
      if (!target) throw new Error('User not found.');

      // Record the current user's "like" decision (idempotent-ish: upsert action).
      await ProfileLike.findOneAndUpdate(
        { fromUserId: toObjectId(user.id), toUserId: toObjectId(userId) },
        { action: 'like' },
        { upsert: true, new: true }
      );

      // Check whether the target already liked the current user.
      const reciprocal = await ProfileLike.findOne({
        fromUserId: toObjectId(userId),
        toUserId: toObjectId(user.id),
        action: 'like',
      });

      if (!reciprocal) {
        return { matched: false, match: null };
      }

      // Create a unique match (canonical order: lower id first).
      const [a, b] = [toObjectId(user.id), toObjectId(userId)].sort((x, y) =>
        String(x) < String(y) ? -1 : 1
      );

      let match = await Match.findOne({ user1: a, user2: b });
      if (!match) {
        const conversation = await Conversation.create({
          participants: [a, b],
        });
        match = await Match.create({
          user1: a,
          user2: b,
          conversationId: conversation._id,
        });
        await Notification.create({
          recipientId: a,
          senderId: b,
          type: 'MATCH',
          referenceId: match._id,
          message: 'You have a new match!',
        });
        await Notification.create({
          recipientId: b,
          senderId: a,
          type: 'MATCH',
          referenceId: match._id,
          message: 'You have a new match!',
        });
      }
      return { matched: true, match };
    },

    passProfile: async (_: any, { userId }: { userId: string }, context: any) => {
      const user = requireUser(context);
      if (user.id === userId) throw new Error('You cannot pass your own profile.');
      if (!isValidId(userId)) throw new Error('Invalid user id.');
      await ProfileLike.findOneAndUpdate(
        { fromUserId: toObjectId(user.id), toUserId: toObjectId(userId) },
        { action: 'pass' },
        { upsert: true, new: true }
      );
      return true;
    },

    removeMatch: async (_: any, { matchId }: { matchId: string }, context: any) => {
      const user = requireUser(context);
      if (!isValidId(matchId)) throw new Error('Invalid match id.');
      const match = await Match.findById(matchId);
      if (!match) throw new Error('Match not found.');
      const uid = String(toObjectId(user.id));
      if (String(match.user1) !== uid && String(match.user2) !== uid) {
        throw new Error('Unauthorized: you can only remove your own matches.');
      }
      await match.deleteOne();
      return true;
    },
  },
};
