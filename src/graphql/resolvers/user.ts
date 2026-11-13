import { Types } from "mongoose";
import { randomBytes, randomInt, createHash } from "crypto";

import { User, IUser } from "../../models/User";
import { requireUser } from "../../middleware/auth";
import { hashPassword, comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";
import { sendPasswordResetOTPEmail } from "../../utils/email";

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

/* =========================================================
   VALIDATION & HELPERS
   ========================================================= */

const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password: string): boolean =>
  typeof password === "string" && password.length >= 6;

const hashValue = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const generateOTP = (): string => randomInt(100000, 1000000).toString();

const generateResetToken = (): string => randomBytes(32).toString("hex");

const OTP_EXPIRY = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RESET_TOKEN_EXPIRY = 10 * 60 * 1000;

/* =========================================================
   USER RESOLVERS
   ========================================================= */

export const userResolvers = {
  User: {
    followersCount: (parent: IUser) => getFollowersCount(String(parent._id)),

    followingCount: (parent: IUser) => getFollowingCount(String(parent._id)),

    likesCount: (parent: IUser) => getLikesCount(String(parent._id)),

    postsCount: (parent: IUser) => getPostsCount(String(parent._id)),

    compatibility: (parent: any) => {
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

  /* =========================================================
     QUERIES
     ========================================================= */

  Query: {
    me: async (_: any, __: any, context: any) => {
      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) throw new Error("User not found.");

      return doc;
    },

    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid user id.");
      }

      const doc = await User.findById(id);

      if (!doc) throw new Error("User not found.");

      const viewer = context.user;

      if (viewer && String(doc._id) === viewer.id) {
        return doc;
      }

      if (doc.privacy?.profileVisibility === "private") {
        if (!viewer) {
          throw new Error("This profile is private.");
        }

        const canSee = await isFollowing(viewer.id, String(doc._id));

        if (!canSee) {
          throw new Error("This profile is private.");
        }
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

      return User.find().sort({ createdAt: -1 }).skip(offset).limit(limit);
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

      const query: any = {
        _id: { $ne: toObjectId(viewer.id) },
      };

      if (me?.location) {
        query.location = me.location;
      }

      const docs = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach(
        (doc) =>
          ((doc as any)._compatibilityViewerInterests = me?.interests || []),
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

      const docs = await User.find({
        _id: { $ne: toObjectId(viewer.id) },
      })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach(
        (doc) =>
          ((doc as any)._compatibilityViewerInterests = me?.interests || []),
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
        (doc) =>
          ((doc as any)._compatibilityViewerInterests = me?.interests || []),
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
        (doc) =>
          ((doc as any)._compatibilityViewerInterests = me?.interests || []),
      );

      return docs;
    },
  },

  /* =========================================================
     MUTATIONS
     ========================================================= */

  Mutation: {
    /* =======================================================
       SIGNUP
       ======================================================= */

    signup: async (
      _: any,
      {
        fullName,
        email,
        password,
      }: {
        fullName: string;
        email: string;
        password: string;
      },
    ) => {
      if (!fullName || !fullName.trim()) {
        throw new Error("Full name is required.");
      }

      if (!validateEmail(email)) {
        throw new Error("Invalid email.");
      }

      if (!validatePassword(password)) {
        throw new Error("Password must be at least 6 characters.");
      }

      const normalized = email.toLowerCase().trim();

      const existing = await User.findOne({
        email: normalized,
      });

      if (existing) {
        throw new Error("A user with this email already exists.");
      }

      const hashed = await hashPassword(password);

      const doc = await User.create({
        fullName: fullName.trim(),
        email: normalized,
        password: hashed,
      });

      const token = signToken({
        id: String(doc._id),
        email: doc.email,
      });

      return { token, user: doc };
    },

    /* =======================================================
       LOGIN
       ======================================================= */

    login: async (
      _: any,
      {
        email,
        password,
      }: {
        email: string;
        password: string;
      },
    ) => {
      const normalized = email.toLowerCase().trim();

      const doc = await User.findOne({
        email: normalized,
      }).select("+password");

      if (!doc) {
        throw new Error("Invalid credentials.");
      }

      const ok = await comparePassword(password, (doc as any).password);

      if (!ok) {
        throw new Error("Invalid credentials.");
      }

      const token = signToken({
        id: String(doc._id),
        email: doc.email,
      });

      (doc as any).password = undefined;

      return { token, user: doc };
    },

    /* =======================================================
       REQUEST PASSWORD RESET OTP
       ======================================================= */

    requestPasswordResetOTP: async (_: any, { email }: { email: string }) => {
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+resetPasswordOTP " +
          "+resetPasswordOTPExpires " +
          "+resetPasswordOTPAttempts " +
          "+resetPasswordLastSentAt " +
          "+resetPasswordToken " +
          "+resetPasswordTokenExpires",
      );

      // Generic response prevents account enumeration.
      if (!doc) {
        return true;
      }

      const now = Date.now();

      // Prevent repeated OTP requests.
      if (doc.resetPasswordLastSentAt) {
        const elapsed = now - new Date(doc.resetPasswordLastSentAt).getTime();

        if (elapsed < OTP_RESEND_COOLDOWN) {
          return true;
        }
      }

      const otp = generateOTP();

      doc.resetPasswordOTP = hashValue(otp);

      doc.resetPasswordOTPExpires = new Date(now + OTP_EXPIRY);

      doc.resetPasswordOTPAttempts = 0;

      doc.resetPasswordLastSentAt = new Date(now);

      // Invalidate any previous reset authorization.
      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      await doc.save();

      try {
        await sendPasswordResetOTPEmail({
          to: doc.email,
          name: doc.fullName,
          otp,
        });
      } catch (error) {
        // Do not leave an active OTP if delivery fails.
        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;
        await doc.save();

        console.error("Password reset OTP email failed:", error);

        throw new Error(
          "Unable to send verification code. Please try again later.",
        );
      }

      return true;
    },

    /* =======================================================
       VERIFY PASSWORD RESET OTP
       ======================================================= */

    verifyPasswordResetOTP: async (
      _: any,
      {
        email,
        otp,
      }: {
        email: string;
        otp: string;
      },
    ) => {
      const normalized = email.toLowerCase().trim();

      if (!validateEmail(normalized)) {
        throw new Error("Invalid or expired verification code.");
      }

      if (!/^\d{6}$/.test(otp)) {
        throw new Error("Invalid or expired verification code.");
      }

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+resetPasswordOTP " +
          "+resetPasswordOTPExpires " +
          "+resetPasswordOTPAttempts",
      );

      if (!doc || !doc.resetPasswordOTP || !doc.resetPasswordOTPExpires) {
        throw new Error("Invalid or expired verification code.");
      }

      const now = Date.now();

      if (new Date(doc.resetPasswordOTPExpires).getTime() <= now) {
        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;

        await doc.save();

        throw new Error("Verification code has expired.");
      }

      if (doc.resetPasswordOTPAttempts >= MAX_OTP_ATTEMPTS) {
        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;

        await doc.save();

        throw new Error(
          "Too many incorrect attempts. Please request a new code.",
        );
      }

      const submittedHash = hashValue(otp);

      if (submittedHash !== doc.resetPasswordOTP) {
        doc.resetPasswordOTPAttempts = (doc.resetPasswordOTPAttempts || 0) + 1;

        if (doc.resetPasswordOTPAttempts >= MAX_OTP_ATTEMPTS) {
          doc.resetPasswordOTP = undefined;
          doc.resetPasswordOTPExpires = undefined;
          doc.resetPasswordOTPAttempts = 0;
        }

        await doc.save();

        throw new Error("Incorrect verification code.");
      }

      // OTP successfully verified.
      const resetToken = generateResetToken();

      doc.resetPasswordToken = hashValue(resetToken);

      doc.resetPasswordTokenExpires = new Date(now + RESET_TOKEN_EXPIRY);

      // OTP can no longer be reused.
      doc.resetPasswordOTP = undefined;
      doc.resetPasswordOTPExpires = undefined;
      doc.resetPasswordOTPAttempts = 0;

      await doc.save();

      // Return raw token only once to the client.
      return resetToken;
    },

    /* =======================================================
       RESET PASSWORD
       ======================================================= */

    resetPassword: async (
      _: any,
      {
        resetToken,
        newPassword,
      }: {
        resetToken: string;
        newPassword: string;
      },
    ) => {
      if (!resetToken || resetToken.length !== 64) {
        throw new Error("Invalid or expired password reset session.");
      }

      if (!validatePassword(newPassword)) {
        throw new Error("Password must be at least 6 characters.");
      }

      const tokenHash = hashValue(resetToken);

      const doc: any = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordTokenExpires: {
          $gt: new Date(),
        },
      }).select(
        "+password " + "+resetPasswordToken " + "+resetPasswordTokenExpires",
      );

      if (!doc) {
        throw new Error("Invalid or expired password reset session.");
      }

      const hashedPassword = await hashPassword(newPassword);

      doc.password = hashedPassword;

      // Invalidate reset authorization after use.
      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      // Clear any remaining OTP information.
      doc.resetPasswordOTP = undefined;
      doc.resetPasswordOTPExpires = undefined;
      doc.resetPasswordOTPAttempts = 0;

      await doc.save();

      return true;
    },

    /* =======================================================
       UPDATE PROFILE
       ======================================================= */

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

          if (clash) {
            throw new Error("Username is already taken.");
          }

          doc.username = candidate;
        } else {
          doc.username = undefined;
        }
      }

      if (input.fullName !== undefined) {
        if (!input.fullName.trim()) {
          throw new Error("Full name cannot be empty.");
        }

        doc.fullName = input.fullName.trim();
      }

      if (input.age !== undefined) doc.age = input.age;
      if (input.bio !== undefined) doc.bio = input.bio;
      if (input.location !== undefined) doc.location = input.location;

      if (input.profileImage !== undefined) {
        doc.profileImage = input.profileImage;
      }

      if (input.interests !== undefined) {
        doc.interests = input.interests;
      }

      await doc.save();

      return doc;
    },

    /* =======================================================
       UPDATE INTERESTS
       ======================================================= */

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

    /* =======================================================
       UPDATE PRIVACY
       ======================================================= */

    updatePrivacy: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) throw new Error("User not found.");

      doc.privacy = {
        ...(doc.privacy ? (doc.privacy as any).toObject() : {}),
        ...input,
      } as any;

      await doc.save();

      return doc;
    },

    /* =======================================================
       UPDATE APPEARANCE
       ======================================================= */

    updateAppearance: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) throw new Error("User not found.");

      doc.appearance = {
        ...(doc.appearance ? (doc.appearance as any).toObject() : {}),
        ...input,
      } as any;

      await doc.save();

      return doc;
    },

    /* =======================================================
       ONLINE STATUS
       ======================================================= */

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
