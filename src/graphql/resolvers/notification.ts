import { Notification } from '../../models/Notification';
import { User } from '../../models/User';
import { requireUser } from '../../middleware/auth';
import { toObjectId, isValidId } from './helpers';

export const notificationResolvers = {
  Notification: {
    recipient: (parent: any) => User.findById(parent.recipientId),
    sender: (parent: any) => User.findById(parent.senderId),
  },

  Query: {
    notifications: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any
    ) => {
      const user = requireUser(context);
      return Notification.find({ recipientId: toObjectId(user.id) })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
    },

    unreadNotificationCount: async (_: any, __: any, context: any) => {
      const user = requireUser(context);
      return Notification.countDocuments({
        recipientId: toObjectId(user.id),
        isRead: false,
      });
    },
  },

  Mutation: {
    markNotificationAsRead: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireUser(context);
      if (!isValidId(id)) throw new Error('Invalid notification id.');
      const notif = await Notification.findById(id);
      if (!notif) throw new Error('Notification not found.');
      if (String(notif.recipientId) !== user.id) {
        throw new Error('Unauthorized: you can only manage your own notifications.');
      }
      notif.isRead = true;
      await notif.save();
      return notif;
    },

    markAllNotificationsAsRead: async (_: any, __: any, context: any) => {
      const user = requireUser(context);
      await Notification.updateMany(
        { recipientId: toObjectId(user.id), isRead: false },
        { isRead: true }
      );
      return true;
    },
  },
};
