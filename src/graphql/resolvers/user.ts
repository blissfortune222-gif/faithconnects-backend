import { Types } from "mongoose";
import { randomBytes, randomInt, createHash } from "crypto";

import { User, IUser } from "../../models/User";
import { requireUser } from "../../middleware/auth";
import { hashPassword, comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";
import {
  sendPasswordResetOTPEmail,
  sendSignupOTPEmail,
} from "../../utils/email";

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
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

const debugLog = (section: string, message: string, data?: unknown) => {
  if (data !== undefined) {
    console.log(`[${section}] ${message}`, data);
  } else {
    console.log(`[${section}] ${message}`);
  }
};

const debugError = (section: string, message: string, error: unknown) => {
  // Avoid logging sensitive values such as passwords, OTPs or tokens.
  console.error(`[${section}] ${message}`, error);
};

const clearSignupOTP = (doc: any) => {
  doc.signupOTP = undefined;
  doc.signupOTPExpires = undefined;
  doc.signupOTPAttempts = 0;
  doc.signupOTPLastSentAt = undefined;
};

const clearResetOTP = (doc: any) => {
  doc.resetPasswordOTP = undefined;
  doc.resetPasswordOTPExpires = undefined;
  doc.resetPasswordOTPAttempts = 0;
  doc.resetPasswordLastSentAt = undefined;
};

/**
 * Treat legacy accounts without isEmailVerified as verified.
 * New signup explicitly stores false.
 */
const verifiedEmailFilter = {
  $or: [{ isEmailVerified: true }, { isEmailVerified: { $exists: false } }],
};

/**
 * Combine the legacy-compatible verification filter with
 * additional query conditions.
 */
const verifiedUsersQuery = (conditions: Record<string, any> = {}) => ({
  $and: [verifiedEmailFilter, conditions],
});

/* =========================================================
   USER RESOLVERS
   ========================================================= */

export const userResolvers = {
  User: {
    // Legacy accounts without this field are treated as verified.
    isEmailVerified: (parent: any) => parent.isEmailVerified ?? true,

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

      return {
        score,
        sharedInterests: shared,
      };
    },
  },

  /* =========================================================
     QUERIES
     ========================================================= */

  Query: {
    me: async (_: any, __: any, context: any) => {
      debugLog("ME", "Fetching authenticated user.");

      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        throw new Error("User not found.");
      }

      return doc;
    },

    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid user id.");
      }

      const doc = await User.findById(id);

      if (!doc) {
        throw new Error("User not found.");
      }

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

      return User.find(verifiedUsersQuery())
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
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

      const conditions: Record<string, any> = {
        _id: { $ne: toObjectId(viewer.id) },
      };

      if (me?.location) {
        conditions.location = me.location;
      }

      const docs = await User.find(verifiedUsersQuery(conditions))
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach((doc) => {
        (doc as any)._compatibilityViewerInterests = me?.interests || [];
      });

      return docs;
    },

    discoverNew: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);

      const me = await User.findById(toObjectId(viewer.id)).select("interests");

      const docs = await User.find(
        verifiedUsersQuery({
          _id: { $ne: toObjectId(viewer.id) },
        }),
      )
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach((doc) => {
        (doc as any)._compatibilityViewerInterests = me?.interests || [];
      });

      return docs;
    },

    discoverOnline: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);

      const me = await User.findById(toObjectId(viewer.id)).select("interests");

      const docs = await User.find(
        verifiedUsersQuery({
          _id: { $ne: toObjectId(viewer.id) },
          isOnline: true,
          "privacy.showOnlineStatus": true,
        }),
      )
        .sort({ lastSeen: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach((doc) => {
        (doc as any)._compatibilityViewerInterests = me?.interests || [];
      });

      return docs;
    },

    discoverVerified: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      const viewer = requireUser(context);

      const me = await User.findById(toObjectId(viewer.id)).select("interests");

      const docs = await User.find(
        verifiedUsersQuery({
          _id: { $ne: toObjectId(viewer.id) },
          isVerified: true,
        }),
      )
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      docs.forEach((doc) => {
        (doc as any)._compatibilityViewerInterests = me?.interests || [];
      });

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
      debugLog("SIGNUP", "Signup request received.");

      if (!fullName?.trim()) {
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
        // Missing field means this is a legacy, already-existing account.
        if (existing.isEmailVerified !== false) {
          throw new Error("A user with this email already exists.");
        }

        throw new Error(
          "This account has not been verified. Please request a new verification code.",
        );
      }

      const hashedPassword = await hashPassword(password);
      const otp = generateOTP();
      const now = Date.now();

      const doc = await User.create({
        fullName: fullName.trim(),
        email: normalized,
        password: hashedPassword,

        isEmailVerified: false,

        signupOTP: hashValue(otp),
        signupOTPExpires: new Date(now + OTP_EXPIRY),
        signupOTPAttempts: 0,
        signupOTPLastSentAt: new Date(now),

        isOnline: false,
      });

      debugLog("SIGNUP", "Unverified account created.", {
        userId: String(doc._id),
      });

      try {
        await sendSignupOTPEmail({
          to: normalized,
          name: doc.fullName,
          otp,
        });

        debugLog("SIGNUP", "Signup verification email accepted.");

        return {
          success: true,
          message: "Verification code sent to your email.",
        };
      } catch (error) {
        debugError("SIGNUP", "Signup email request failed.", error);

        const pending: any = await User.findById(doc._id).select(
          "+signupOTP +signupOTPExpires +signupOTPAttempts +signupOTPLastSentAt",
        );

        if (pending) {
          clearSignupOTP(pending);
          await pending.save();
        }

        throw new Error(
          "Your account was created, but we couldn't send the verification email. Please request a new code.",
        );
      }
    },

    /* =======================================================
       VERIFY SIGNUP OTP
       ======================================================= */

    verifySignupOTP: async (
      _: any,
      {
        email,
        otp,
      }: {
        email: string;
        otp: string;
      },
    ) => {
      debugLog("SIGNUP OTP", "Verification request received.");

      if (!validateEmail(email)) {
        throw new Error("Invalid or expired verification code.");
      }

      if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        throw new Error("Enter a valid six-digit verification code.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+signupOTP +signupOTPExpires +signupOTPAttempts +signupOTPLastSentAt",
      );

      if (!doc) {
        throw new Error("Invalid or expired verification code.");
      }

      if (doc.isEmailVerified === true) {
        throw new Error("This email address is already verified.");
      }

      if (!doc.signupOTP || !doc.signupOTPExpires) {
        throw new Error(
          "No active verification code. Please request a new one.",
        );
      }

      const now = Date.now();
      const expiry = new Date(doc.signupOTPExpires).getTime();

      if (expiry <= now) {
        clearSignupOTP(doc);
        await doc.save();

        throw new Error(
          "Verification code has expired. Please request a new one.",
        );
      }

      if ((doc.signupOTPAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        clearSignupOTP(doc);
        await doc.save();

        throw new Error(
          "Too many incorrect attempts. Please request a new code.",
        );
      }

      const submittedHash = hashValue(otp);

      if (submittedHash !== doc.signupOTP) {
        /*
         * Atomic increment: prevents two simultaneous incorrect
         * requests from both using the same attempt count.
         */
        const updated: any = await User.findOneAndUpdate(
          {
            _id: doc._id,
            isEmailVerified: false,
            signupOTP: doc.signupOTP,
            signupOTPExpires: { $gt: new Date() },
            signupOTPAttempts: { $lt: MAX_OTP_ATTEMPTS },
          },
          {
            $inc: { signupOTPAttempts: 1 },
          },
          {
            new: true,
          },
        ).select("+signupOTPAttempts");

        if (!updated) {
          throw new Error(
            "Verification code is no longer valid. Please request a new one.",
          );
        }

        const attempts = updated.signupOTPAttempts || 0;

        if (attempts >= MAX_OTP_ATTEMPTS) {
          await User.updateOne(
            {
              _id: doc._id,
              isEmailVerified: false,
              signupOTP: doc.signupOTP,
            },
            {
              $unset: {
                signupOTP: 1,
                signupOTPExpires: 1,
                signupOTPLastSentAt: 1,
              },
              $set: {
                signupOTPAttempts: 0,
              },
            },
          );

          throw new Error(
            "Too many incorrect attempts. Please request a new code.",
          );
        }

        throw new Error(
          `Incorrect verification code. ${MAX_OTP_ATTEMPTS - attempts} attempts remaining.`,
        );
      }

      /*
       * Only verify if the same OTP is still active and unexpired.
       * This prevents an old OTP from verifying an account after
       * a newer code has been issued.
       */
      const verified: any = await User.findOneAndUpdate(
        {
          _id: doc._id,
          isEmailVerified: false,
          signupOTP: submittedHash,
          signupOTPExpires: { $gt: new Date() },
          signupOTPAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        {
          $set: {
            isEmailVerified: true,
            signupOTPAttempts: 0,
          },
          $unset: {
            signupOTP: 1,
            signupOTPExpires: 1,
            signupOTPLastSentAt: 1,
          },
        },
        {
          new: true,
        },
      );

      if (!verified) {
        throw new Error(
          "Verification code is no longer valid. Please request a new one.",
        );
      }

      const token = signToken({
        id: String(verified._id),
        email: verified.email,
      });

      debugLog("SIGNUP OTP", "Email verified successfully.", {
        userId: String(verified._id),
      });

      return {
        token,
        user: verified,
      };
    },

    /* =======================================================
       RESEND SIGNUP OTP
       ======================================================= */

    resendSignupOTP: async (_: any, { email }: { email: string }) => {
      debugLog("RESEND SIGNUP OTP", "Resend request received.");

      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+signupOTP +signupOTPExpires +signupOTPAttempts +signupOTPLastSentAt",
      );

      if (!doc) {
        throw new Error("No account found with this email address.");
      }

      if (doc.isEmailVerified === true) {
        throw new Error("This email address is already verified.");
      }

      const now = Date.now();

      if (doc.signupOTPLastSentAt) {
        const elapsed = now - new Date(doc.signupOTPLastSentAt).getTime();

        if (elapsed < OTP_RESEND_COOLDOWN) {
          const remaining = Math.ceil((OTP_RESEND_COOLDOWN - elapsed) / 1000);

          throw new Error(
            `Please wait ${remaining} seconds before requesting another code.`,
          );
        }
      }

      const otp = generateOTP();

      doc.signupOTP = hashValue(otp);
      doc.signupOTPExpires = new Date(now + OTP_EXPIRY);
      doc.signupOTPAttempts = 0;
      doc.signupOTPLastSentAt = new Date(now);

      await doc.save();

      try {
        await sendSignupOTPEmail({
          to: doc.email,
          name: doc.fullName,
          otp,
        });

        debugLog("RESEND SIGNUP OTP", "New OTP email accepted.");

        return true;
      } catch (error) {
        debugError("RESEND SIGNUP OTP", "Email request failed.", error);

        clearSignupOTP(doc);
        await doc.save();

        throw new Error(
          "Unable to send verification code. Please try again later.",
        );
      }
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
      debugLog("LOGIN", "Login request received.");

      if (!validateEmail(email)) {
        throw new Error("Invalid credentials.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select("+password");

      if (!doc) {
        throw new Error("Invalid credentials.");
      }

      const ok = await comparePassword(password, doc.password);

      if (!ok) {
        throw new Error("Invalid credentials.");
      }

      // Only explicitly unverified accounts are blocked.
      // Legacy accounts without this field remain able to log in.
      if (doc.isEmailVerified === false) {
        throw new Error("Please verify your email address before logging in.");
      }

      const token = signToken({
        id: String(doc._id),
        email: doc.email,
      });

      doc.isOnline = true;
      doc.lastSeen = new Date();

      await doc.save();

      doc.password = undefined;

      debugLog("LOGIN", "Login successful.", {
        userId: String(doc._id),
      });

      return {
        token,
        user: doc,
      };
    },

    /* =======================================================
       REQUEST PASSWORD RESET OTP
       ======================================================= */

    requestPasswordResetOTP: async (_: any, { email }: { email: string }) => {
      debugLog("OTP REQUEST", "Password reset OTP request received.");

      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+resetPasswordOTP +resetPasswordOTPExpires +resetPasswordOTPAttempts +resetPasswordLastSentAt +resetPasswordToken +resetPasswordTokenExpires",
      );

      // Generic response avoids revealing registered email addresses.
      if (!doc) {
        return true;
      }

      const now = Date.now();

      if (doc.resetPasswordLastSentAt) {
        const elapsed = now - new Date(doc.resetPasswordLastSentAt).getTime();

        if (elapsed < OTP_RESEND_COOLDOWN) {
          return false;
        }
      }

      const otp = generateOTP();

      doc.resetPasswordOTP = hashValue(otp);
      doc.resetPasswordOTPExpires = new Date(now + OTP_EXPIRY);
      doc.resetPasswordOTPAttempts = 0;
      doc.resetPasswordLastSentAt = new Date(now);

      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      await doc.save();

      try {
        await sendPasswordResetOTPEmail({
          to: doc.email,
          name: doc.fullName,
          otp,
        });

        return true;
      } catch (error) {
        debugError(
          "OTP REQUEST",
          "Password reset email request failed.",
          error,
        );

        clearResetOTP(doc);
        await doc.save();

        throw new Error(
          "Unable to send verification code. Please try again later.",
        );
      }
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
      debugLog("OTP VERIFY", "Password reset verification received.");

      if (!validateEmail(email)) {
        throw new Error("Invalid or expired verification code.");
      }

      if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        throw new Error("Invalid or expired verification code.");
      }

      const normalized = email.toLowerCase().trim();

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+resetPasswordOTP +resetPasswordOTPExpires +resetPasswordOTPAttempts +resetPasswordLastSentAt",
      );

      if (!doc || !doc.resetPasswordOTP || !doc.resetPasswordOTPExpires) {
        throw new Error("Invalid or expired verification code.");
      }

      const now = Date.now();
      const expiry = new Date(doc.resetPasswordOTPExpires).getTime();

      if (expiry <= now) {
        clearResetOTP(doc);
        await doc.save();

        throw new Error("Verification code has expired.");
      }

      if ((doc.resetPasswordOTPAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        clearResetOTP(doc);
        await doc.save();

        throw new Error(
          "Too many incorrect attempts. Please request a new code.",
        );
      }

      if (hashValue(otp) !== doc.resetPasswordOTP) {
        const updated: any = await User.findOneAndUpdate(
          {
            _id: doc._id,
            resetPasswordOTP: doc.resetPasswordOTP,
            resetPasswordOTPExpires: { $gt: new Date() },
            resetPasswordOTPAttempts: { $lt: MAX_OTP_ATTEMPTS },
          },
          {
            $inc: { resetPasswordOTPAttempts: 1 },
          },
          {
            new: true,
          },
        ).select("+resetPasswordOTPAttempts");

        if (!updated) {
          throw new Error(
            "Verification code is no longer valid. Please request a new one.",
          );
        }

        if (updated.resetPasswordOTPAttempts >= MAX_OTP_ATTEMPTS) {
          await User.updateOne(
            {
              _id: doc._id,
              resetPasswordOTP: doc.resetPasswordOTP,
            },
            {
              $unset: {
                resetPasswordOTP: 1,
                resetPasswordOTPExpires: 1,
                resetPasswordLastSentAt: 1,
              },
              $set: {
                resetPasswordOTPAttempts: 0,
              },
            },
          );

          throw new Error(
            "Too many incorrect attempts. Please request a new code.",
          );
        }

        throw new Error("Incorrect verification code.");
      }

      const resetToken = generateResetToken();

      const updated: any = await User.findOneAndUpdate(
        {
          _id: doc._id,
          resetPasswordOTP: hashValue(otp),
          resetPasswordOTPExpires: { $gt: new Date() },
          resetPasswordOTPAttempts: { $lt: MAX_OTP_ATTEMPTS },
        },
        {
          $set: {
            resetPasswordToken: hashValue(resetToken),
            resetPasswordTokenExpires: new Date(
              Date.now() + RESET_TOKEN_EXPIRY,
            ),
            resetPasswordOTPAttempts: 0,
          },
          $unset: {
            resetPasswordOTP: 1,
            resetPasswordOTPExpires: 1,
            resetPasswordLastSentAt: 1,
          },
        },
        {
          new: true,
        },
      );

      if (!updated) {
        throw new Error(
          "Verification code is no longer valid. Please request a new one.",
        );
      }

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
      debugLog("RESET PASSWORD", "Password reset request received.");

      if (typeof resetToken !== "string" || resetToken.length !== 64) {
        throw new Error("Invalid or expired password reset session.");
      }

      if (!validatePassword(newPassword)) {
        throw new Error("Password must be at least 6 characters.");
      }

      const doc: any = await User.findOne({
        resetPasswordToken: hashValue(resetToken),
        resetPasswordTokenExpires: { $gt: new Date() },
      }).select(
        "+password +resetPasswordToken +resetPasswordTokenExpires +resetPasswordOTP +resetPasswordOTPExpires +resetPasswordOTPAttempts +resetPasswordLastSentAt",
      );

      if (!doc) {
        throw new Error("Invalid or expired password reset session.");
      }

      doc.password = await hashPassword(newPassword);

      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      clearResetOTP(doc);

      await doc.save();

      debugLog("RESET PASSWORD", "Password updated successfully.");

      return true;
    },

    /* =======================================================
       UPDATE PROFILE
       ======================================================= */

    updateProfile: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        throw new Error("User not found.");
      }

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

      if (input.age !== undefined) {
        doc.age = input.age;
      }

      if (input.bio !== undefined) {
        doc.bio = input.bio;
      }

      if (input.location !== undefined) {
        doc.location = input.location;
      }

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

      if (!doc) {
        throw new Error("User not found.");
      }

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

      if (!doc) {
        throw new Error("User not found.");
      }

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

      if (!doc) {
        throw new Error("User not found.");
      }

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

      if (!doc) {
        throw new Error("User not found.");
      }

      doc.isOnline = isOnline;

      if (!isOnline) {
        doc.lastSeen = new Date();
      }

      await doc.save();

      debugLog("ONLINE STATUS", "Presence updated.", {
        userId: String(doc._id),
        isOnline: doc.isOnline,
      });

      return doc;
    },
  },
};
