import { Types } from "mongoose";
import { User, IUser } from "../../models/User";
import { requireUser } from "../../middleware/auth";
import { hashPassword, comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";
import {
  getFollowersCount,
  getFollowingCount,
  getLikesCount,
  getPostsCount,
  isFollowing,
  toObjectId,
} from "./helpers";
import {
  calculateCompatibility,
  sharedInterests,
} from "../../utils/compatibility";

const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password: string): boolean => password.length >= 6;
// const validateEmail = (email: string): boolean =>
//   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// const validatePassword = (password: string): boolean => password.length >= 6;
export const userResolvers = {
  User: {
    followersCount: (parent: IUser) => getFollowersCount(String(parent._id)),
    followingCount: (parent: IUser) => getFollowingCount(String(parent._id)),
    likesCount: (parent: IUser) => getLikesCount(String(parent._id)),
    postsCount: (parent: IUser) => getPostsCount(String(parent._id)),
    compatibility: (parent: any) => {
      // Only populated when the viewer is set on the parent (discover/profile).
      if (!parent._compatibilityViewerInterests) return null;
      const score = calculateCompatibility(
        parent._compatibilityViewerInterests,
        parent.interests || [],
      );
      const shared = sharedInterests(
        parent._compatibilityViewerInterests,
        parent.interests || [],
      );
      return { score, sharedInterests: shared };
    },
  },

  Query: {
    me: async (_: any, __: any, context: any) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");
      return doc;
    },

    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!Types.ObjectId.isValid(id)) throw new Error("Invalid user id.");
      const doc = await User.findById(id);
      if (!doc) throw new Error("User not found.");
      const viewer = context.user;
      // Respect privacy: private profiles are only visible to self or followers.
      if (viewer && String(doc._id) === viewer.id) return doc;
      if (doc.privacy?.profileVisibility === "private") {
        if (!viewer) throw new Error("This profile is private.");
        const canSee = await isFollowing(viewer.id, String(doc._id));
        if (!canSee) throw new Error("This profile is private.");
      }
      if (viewer) {
        (doc as any)._compatibilityViewerInterests =
          (await User.findById(viewer.id).select("interests"))?.interests || [];
      }
      return doc;
    },

    users: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      requireUser(context);
      const docs = await User.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      return docs;
    },

    discoverNearby: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);
      const me = await User.findById(toObjectId(viewer.id)).select(
        "location interests",
      );
      const query: any = { _id: { $ne: toObjectId(viewer.id) } };
      if (me?.location) query.location = me.location;
      const docs = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      docs.forEach(
        (d) => ((d as any)._compatibilityViewerInterests = me?.interests || []),
      );
      return docs;
    },

    discoverNew: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);
      const me = await User.findById(toObjectId(viewer.id)).select("interests");
      const docs = await User.find({ _id: { $ne: toObjectId(viewer.id) } })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      docs.forEach(
        (d) => ((d as any)._compatibilityViewerInterests = me?.interests || []),
      );
      return docs;
    },

    discoverOnline: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);
      const me = await User.findById(toObjectId(viewer.id)).select("interests");
      const docs = await User.find({
        _id: { $ne: toObjectId(viewer.id) },
        isOnline: true,
        "privacy.showOnlineStatus": true,
      })
        .sort({ lastSeen: -1 })
        .skip(offset)
        .limit(limit);
      docs.forEach(
        (d) => ((d as any)._compatibilityViewerInterests = me?.interests || []),
      );
      return docs;
    },

    discoverVerified: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);
      const me = await User.findById(toObjectId(viewer.id)).select("interests");
      const docs = await User.find({
        _id: { $ne: toObjectId(viewer.id) },
        isVerified: true,
      })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
      docs.forEach(
        (d) => ((d as any)._compatibilityViewerInterests = me?.interests || []),
      );
      return docs;
    },
  },

  Mutation: {
    signup: async (
      _: any,
      {
        fullName,
        email,
        password,
      }: { fullName: string; email: string; password: string },
    ) => {
      if (!fullName || !fullName.trim())
        throw new Error("Full name is required.");
      if (!validateEmail(email)) throw new Error("Invalid email.");
      if (!validatePassword(password))
        throw new Error("Password must be at least 6 characters.");

      const normalized = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalized });
      if (existing) throw new Error("A user with this email already exists.");

      const hashed = await hashPassword(password);
      const doc = await User.create({
        fullName: fullName.trim(),
        email: normalized,
        password: hashed,
      });

      const token = signToken({ id: String(doc._id), email: doc.email });
      return { token, user: doc };
    },

    login: async (
      _: any,
      { email, password }: { email: string; password: string },
    ) => {
      const normalized = email.toLowerCase().trim();
      const doc = await User.findOne({ email: normalized }).select("+password");
      if (!doc) throw new Error("Invalid credentials.");
      const ok = await comparePassword(password, doc.password);
      if (!ok) throw new Error("Invalid credentials.");
      const token = signToken({ id: String(doc._id), email: doc.email });
      // Strip password before returning.
      (doc as any).password = undefined;
      return { token, user: doc };
    },

    updateProfile: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");

      if (input.username !== undefined) {
        const candidate = String(input.username).toLowerCase().trim();
        if (candidate) {
          const clash = await User.findOne({
            username: candidate,
            _id: { $ne: doc._id },
          });
          if (clash) throw new Error("Username is already taken.");
          doc.username = candidate;
        } else {
          doc.username = undefined;
        }
      }
      if (input.fullName !== undefined) {
        if (!input.fullName.trim())
          throw new Error("Full name cannot be empty.");
        doc.fullName = input.fullName.trim();
      }
      if (input.age !== undefined) doc.age = input.age;
      if (input.bio !== undefined) doc.bio = input.bio;
      if (input.location !== undefined) doc.location = input.location;
      if (input.profileImage !== undefined)
        doc.profileImage = input.profileImage;
      if (input.interests !== undefined) doc.interests = input.interests;

      await doc.save();
      return doc;
    },

    updateInterests: async (
      _: any,
      { interests }: { interests: string[] },
      context: any,
    ) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");
      doc.interests = interests;
      await doc.save();
      return doc;
    },

    updatePrivacy: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");
      // doc.privacy = { ...(doc.privacy as any).toObject(), ...input } as any;
      doc.privacy = {
        ...(doc.privacy ? (doc.privacy as any).toObject() : {}),
        ...input,
      } as any;
      await doc.save();
      return doc;
    },

    updateAppearance: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");
      // doc.appearance = {
      //   ...(doc.appearance as any).toObject(),
      //   ...input,
      // } as any;
      doc.appearance = {
        ...(doc.appearance ? (doc.appearance as any).toObject() : {}),
        ...input,
      } as any;
      await doc.save();
      return doc;
    },

    setOnlineStatus: async (
      _: any,
      { isOnline }: { isOnline: boolean },
      context: any,
    ) => {
      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));
      if (!doc) throw new Error("User not found.");
      doc.isOnline = isOnline;
      doc.lastSeen = new Date();
      await doc.save();
      return doc;
    },
  },
};
