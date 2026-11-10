import { Follow } from '../../models/Follow';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { requireUser } from '../../middleware/auth';
import { toObjectId, isFollowing as isFollowingHelper } from './helpers';

export const followResolvers = {
  Query: {
    followers: async (_: any, { userId }: { userId: string }, context: any) => {
      requireUser(context);
      const edges = await Follow.find({ followingId: toObjectId(userId) })
        .populate('followerId')
        .sort({ createdAt: -1 });
      return edges.map((e: any) => e.followerId).filter(Boolean);
    },

    following: async (_: any, { userId }: { userId: string }, context: any) => {
      requireUser(context);
      const edges = await Follow.find({ followerId: toObjectId(userId) })
        .populate('followingId')
        .sort({ createdAt: -1 });
      return edges.map((e: any) => e.followingId).filter(Boolean);
    },

    isFollowing: async (_: any, { userId }: { userId: string }, context: any) => {
      const user = requireUser(context);
      return isFollowingHelper(user.id, userId);
    },
  },

  Mutation: {
    followUser: async (_: any, { userId }: { userId: string }, context: any) => {
      const user = requireUser(context);
      if (user.id === userId) throw new Error('You cannot follow yourself.');
      const target = await User.findById(toObjectId(userId));
      if (!target) throw new Error('User not found.');

      const existing = await Follow.findOne({
        followerId: toObjectId(user.id),
        followingId: toObjectId(userId),
      });
      if (existing) throw new Error('You are already following this user.');

      await Follow.create({
        followerId: toObjectId(user.id),
        followingId: toObjectId(userId),
      });

      await Notification.create({
        recipientId: toObjectId(userId),
        senderId: toObjectId(user.id),
        type: 'FOLLOW',
        referenceId: toObjectId(user.id),
        message: 'started following you.',
      });

      return target;
    },

    unfollowUser: async (_: any, { userId }: { userId: string }, context: any) => {
      const user = requireUser(context);
      if (user.id === userId) throw new Error('You cannot unfollow yourself.');
      const target = await User.findById(toObjectId(userId));
      if (!target) throw new Error('User not found.');

      await Follow.deleteOne({
        followerId: toObjectId(user.id),
        followingId: toObjectId(userId),
      });
      return target;
    },
  },
};
