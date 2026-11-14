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

/**
 * Debug logger.
 * Never pass passwords, raw OTPs, reset tokens, or hashes.
 */
const debugLog = (section: string, message: string, data?: unknown) => {
  if (data !== undefined) {
    console.log(`[${section}] ${message}`, data);
  } else {
    console.log(`[${section}] ${message}`);
  }
};

const debugError = (section: string, message: string, error: unknown) => {
  console.error(`[${section}] ${message}`, error);
};

/* =========================================================
   USER RESOLVERS
   ========================================================= */

export const userResolvers = {
  User: {
    followersCount: (parent: IUser) => {
      return getFollowersCount(String(parent._id));
    },

    followingCount: (parent: IUser) => {
      return getFollowingCount(String(parent._id));
    },

    likesCount: (parent: IUser) => {
      return getLikesCount(String(parent._id));
    },

    postsCount: (parent: IUser) => {
      return getPostsCount(String(parent._id));
    },

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
      debugLog("ME", "Fetching authenticated user.");

      const user = requireUser(context);
      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("ME", "User not found.");
        throw new Error("User not found.");
      }

      debugLog("ME", "Authenticated user fetched successfully.");

      return doc;
    },

    user: async (_: any, { id }: { id: string }, context: any) => {
      debugLog("USER", "Fetching user profile.");

      if (!Types.ObjectId.isValid(id)) {
        debugLog("USER", "Invalid user ID.");
        throw new Error("Invalid user id.");
      }

      const doc = await User.findById(id);

      if (!doc) {
        debugLog("USER", "User profile not found.");
        throw new Error("User not found.");
      }

      const viewer = context.user;

      if (viewer && String(doc._id) === viewer.id) {
        debugLog("USER", "Returning own profile.");
        return doc;
      }

      if (doc.privacy?.profileVisibility === "private") {
        if (!viewer) {
          debugLog("USER", "Private profile requested without authentication.");
          throw new Error("This profile is private.");
        }

        const canSee = await isFollowing(viewer.id, String(doc._id));

        if (!canSee) {
          debugLog("USER", "Private profile access denied.");
          throw new Error("This profile is private.");
        }
      }

      if (viewer) {
        (doc as any)._compatibilityViewerInterests =
          (await User.findById(viewer.id).select("interests"))?.interests || [];
      }

      debugLog("USER", "User profile fetched successfully.");

      return doc;
    },

    users: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      debugLog("USERS", "Fetching users.", { limit, offset });

      requireUser(context);

      const docs = await User.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);

      debugLog("USERS", "Users fetched.", { count: docs.length });

      return docs;
    },

    discoverNearby: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      debugLog("DISCOVER NEARBY", "Starting nearby discovery.");

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

      debugLog("DISCOVER NEARBY", "Discovery completed.", {
        count: docs.length,
      });

      return docs;
    },

    discoverNew: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      debugLog("DISCOVER NEW", "Starting new-user discovery.");

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

      debugLog("DISCOVER NEW", "Discovery completed.", {
        count: docs.length,
      });

      return docs;
    },

    discoverOnline: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      debugLog("DISCOVER ONLINE", "Starting online-user discovery.");

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

      debugLog("DISCOVER ONLINE", "Discovery completed.", {
        count: docs.length,
      });

      return docs;
    },

    discoverVerified: async (
      _: any,
      { limit, offset }: { limit: number; offset: number },
      context: any,
    ) => {
      debugLog("DISCOVER VERIFIED", "Starting verified-user discovery.");

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

      debugLog("DISCOVER VERIFIED", "Discovery completed.", {
        count: docs.length,
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

      const existing = await User.findOne({ email: normalized });

      if (existing) {
        debugLog("SIGNUP", "Signup rejected: email already exists.");
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

      debugLog("SIGNUP", "User registered successfully.");

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
      debugLog("LOGIN", "Login request received.");

      const normalized = email.toLowerCase().trim();

      const doc = await User.findOne({
        email: normalized,
      }).select("+password");

      if (!doc) {
        debugLog("LOGIN", "Login failed: account not found.");
        throw new Error("Invalid credentials.");
      }

      const ok = await comparePassword(password, (doc as any).password);

      if (!ok) {
        debugLog("LOGIN", "Login failed: password mismatch.");
        throw new Error("Invalid credentials.");
      }

      const token = signToken({
        id: String(doc._id),
        email: doc.email,
      });

      (doc as any).password = undefined;

      debugLog("LOGIN", "Login successful.");

      return { token, user: doc };
    },

    /* =======================================================
       REQUEST PASSWORD RESET OTP
       ======================================================= */

    requestPasswordResetOTP: async (_: any, { email }: { email: string }) => {
      debugLog("OTP REQUEST", "Password reset OTP request received.");

      if (!validateEmail(email)) {
        debugLog("OTP REQUEST", "Rejected: invalid email format.");
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
        debugLog(
          "OTP REQUEST",
          "No matching account. Returning generic response.",
        );

        return true;
      }

      const now = Date.now();

      // Enforce resend cooldown.
      if (doc.resetPasswordLastSentAt) {
        const elapsed = now - new Date(doc.resetPasswordLastSentAt).getTime();

        if (elapsed < OTP_RESEND_COOLDOWN) {
          const remainingSeconds = Math.ceil(
            (OTP_RESEND_COOLDOWN - elapsed) / 1000,
          );

          debugLog("OTP REQUEST", "Resend cooldown active.", {
            remainingSeconds,
          });

          // The frontend must not display a successful send message.
          return false;
        }
      }

      const otp = generateOTP();
      const otpHash = hashValue(otp);

      doc.resetPasswordOTP = otpHash;
      doc.resetPasswordOTPExpires = new Date(now + OTP_EXPIRY);
      doc.resetPasswordOTPAttempts = 0;
      doc.resetPasswordLastSentAt = new Date(now);

      // Invalidate previous reset authorization.
      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      debugLog("OTP REQUEST", "Saving newly generated OTP.");

      await doc.save();

      // Verify that the OTP hash was persisted.
      const savedDoc: any = await User.findById(doc._id).select(
        "+resetPasswordOTP",
      );

      const hashSavedCorrectly = savedDoc?.resetPasswordOTP === otpHash;

      debugLog("OTP REQUEST", "OTP persistence check completed.", {
        saved: Boolean(savedDoc?.resetPasswordOTP),
        hashMatchesGeneratedOTP: hashSavedCorrectly,
        storedHashLength: savedDoc?.resetPasswordOTP?.length || 0,
      });

      if (!hashSavedCorrectly) {
        debugLog("OTP REQUEST", "OTP persistence verification failed.");

        throw new Error(
          "Unable to generate verification code. Please try again.",
        );
      }

      try {
        debugLog("OTP REQUEST", "Attempting to send OTP email.");

        await sendPasswordResetOTPEmail({
          to: doc.email,
          name: doc.fullName,
          otp,
        });

        debugLog("OTP REQUEST", "OTP email delivery completed.");

        return true;
      } catch (error) {
        debugError("OTP REQUEST", "OTP email delivery failed.", error);

        // Invalidate OTP after delivery failure.
        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;
        doc.resetPasswordLastSentAt = undefined;

        doc.resetPasswordToken = undefined;
        doc.resetPasswordTokenExpires = undefined;

        await doc.save();

        debugLog("OTP REQUEST", "Failed OTP cleared. Resend cooldown reset.");

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
      debugLog("OTP VERIFY", "OTP verification request received.");

      if (!email || typeof email !== "string") {
        debugLog("OTP VERIFY", "Rejected: email is missing or invalid.");
        throw new Error("Invalid or expired verification code.");
      }

      const normalized = email.toLowerCase().trim();

      if (!validateEmail(normalized)) {
        debugLog("OTP VERIFY", "Rejected: invalid email format.");
        throw new Error("Invalid or expired verification code.");
      }

      if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        debugLog("OTP VERIFY", "Rejected: OTP must be exactly six digits.", {
          receivedType: typeof otp,
          receivedLength: typeof otp === "string" ? otp.length : null,
        });

        throw new Error("Invalid or expired verification code.");
      }

      debugLog("OTP VERIFY", "Looking up account and stored OTP.");

      const doc: any = await User.findOne({
        email: normalized,
      }).select(
        "+resetPasswordOTP " +
          "+resetPasswordOTPExpires " +
          "+resetPasswordOTPAttempts",
      );

      if (!doc) {
        debugLog("OTP VERIFY", "Verification failed: account not found.");
        throw new Error("Invalid or expired verification code.");
      }

      if (!doc.resetPasswordOTP || !doc.resetPasswordOTPExpires) {
        debugLog(
          "OTP VERIFY",
          "Verification failed: stored OTP or expiry is missing.",
          {
            hasStoredOTP: Boolean(doc.resetPasswordOTP),
            hasExpiry: Boolean(doc.resetPasswordOTPExpires),
          },
        );

        throw new Error("Invalid or expired verification code.");
      }

      const now = Date.now();

      const expiryTime = new Date(doc.resetPasswordOTPExpires).getTime();

      debugLog("OTP VERIFY", "OTP record found.", {
        hasStoredOTP: Boolean(doc.resetPasswordOTP),
        storedHashLength: doc.resetPasswordOTP.length,
        attempts: doc.resetPasswordOTPAttempts || 0,
        expiresAt: new Date(expiryTime).toISOString(),
        isExpired: expiryTime <= now,
      });

      // Check expiry.
      if (expiryTime <= now) {
        debugLog("OTP VERIFY", "OTP has expired. Clearing OTP.");

        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;
        doc.resetPasswordLastSentAt = undefined;

        await doc.save();

        throw new Error("Verification code has expired.");
      }

      // Check maximum attempts.
      if ((doc.resetPasswordOTPAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        debugLog("OTP VERIFY", "Maximum OTP attempts reached.");

        doc.resetPasswordOTP = undefined;
        doc.resetPasswordOTPExpires = undefined;
        doc.resetPasswordOTPAttempts = 0;
        doc.resetPasswordLastSentAt = undefined;

        await doc.save();

        throw new Error(
          "Too many incorrect attempts. Please request a new code.",
        );
      }

      // Hash submitted OTP.
      const submittedHash = hashValue(otp);

      const hashMatches = submittedHash === doc.resetPasswordOTP;

      debugLog("OTP VERIFY", "Hash comparison completed.", {
        submittedLength: otp.length,
        submittedHashLength: submittedHash.length,
        storedHashLength: doc.resetPasswordOTP.length,
        hashMatches,
      });

      if (!hashMatches) {
        const previousAttempts = doc.resetPasswordOTPAttempts || 0;
        const newAttempts = previousAttempts + 1;

        doc.resetPasswordOTPAttempts = newAttempts;

        debugLog("OTP VERIFY", "OTP mismatch.", {
          previousAttempts,
          newAttempts,
          maximumAttempts: MAX_OTP_ATTEMPTS,
        });

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          debugLog("OTP VERIFY", "Maximum attempts reached. Invalidating OTP.");

          doc.resetPasswordOTP = undefined;
          doc.resetPasswordOTPExpires = undefined;
          doc.resetPasswordOTPAttempts = 0;
          doc.resetPasswordLastSentAt = undefined;
        }

        await doc.save();

        throw new Error("Incorrect verification code.");
      }

      // OTP successfully verified.
      debugLog("OTP VERIFY", "OTP verified successfully.");

      const resetToken = generateResetToken();

      doc.resetPasswordToken = hashValue(resetToken);
      doc.resetPasswordTokenExpires = new Date(now + RESET_TOKEN_EXPIRY);

      // OTP can no longer be reused.
      doc.resetPasswordOTP = undefined;
      doc.resetPasswordOTPExpires = undefined;
      doc.resetPasswordOTPAttempts = 0;
      doc.resetPasswordLastSentAt = undefined;

      await doc.save();

      debugLog("OTP VERIFY", "Reset authorization created.", {
        tokenGenerated: Boolean(resetToken),
        tokenLength: resetToken.length,
        expiresAt: new Date(now + RESET_TOKEN_EXPIRY).toISOString(),
      });

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
      debugLog("RESET PASSWORD", "Password reset request received.");

      if (typeof resetToken !== "string" || resetToken.length !== 64) {
        debugLog("RESET PASSWORD", "Rejected: invalid reset token format.");

        throw new Error("Invalid or expired password reset session.");
      }

      if (!validatePassword(newPassword)) {
        debugLog(
          "RESET PASSWORD",
          "Rejected: password does not meet minimum length.",
        );

        throw new Error("Password must be at least 6 characters.");
      }

      const tokenHash = hashValue(resetToken);

      debugLog(
        "RESET PASSWORD",
        "Looking up valid password reset authorization.",
      );

      const doc: any = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordTokenExpires: {
          $gt: new Date(),
        },
      }).select(
        "+password " + "+resetPasswordToken " + "+resetPasswordTokenExpires",
      );

      if (!doc) {
        debugLog("RESET PASSWORD", "Reset authorization not found or expired.");

        throw new Error("Invalid or expired password reset session.");
      }

      debugLog(
        "RESET PASSWORD",
        "Valid reset authorization found. Hashing new password.",
      );

      const hashedPassword = await hashPassword(newPassword);

      doc.password = hashedPassword;

      // Invalidate reset authorization after use.
      doc.resetPasswordToken = undefined;
      doc.resetPasswordTokenExpires = undefined;

      // Clear any remaining OTP information.
      doc.resetPasswordOTP = undefined;
      doc.resetPasswordOTPExpires = undefined;
      doc.resetPasswordOTPAttempts = 0;
      doc.resetPasswordLastSentAt = undefined;

      await doc.save();

      debugLog(
        "RESET PASSWORD",
        "Password updated successfully. Reset authorization invalidated.",
      );

      return true;
    },

    /* =======================================================
       UPDATE PROFILE
       ======================================================= */

    updateProfile: async (_: any, { input }: any, context: any) => {
      debugLog("UPDATE PROFILE", "Profile update request received.");

      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("UPDATE PROFILE", "User not found.");
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
            debugLog("UPDATE PROFILE", "Username already taken.");
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

      debugLog("UPDATE PROFILE", "Profile updated successfully.");

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
      debugLog("UPDATE INTERESTS", "Interests update request received.");

      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("UPDATE INTERESTS", "User not found.");
        throw new Error("User not found.");
      }

      doc.interests = interests;

      await doc.save();

      debugLog("UPDATE INTERESTS", "Interests updated successfully.");

      return doc;
    },

    /* =======================================================
       UPDATE PRIVACY
       ======================================================= */

    updatePrivacy: async (_: any, { input }: any, context: any) => {
      debugLog("UPDATE PRIVACY", "Privacy update request received.");

      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("UPDATE PRIVACY", "User not found.");
        throw new Error("User not found.");
      }

      doc.privacy = {
        ...(doc.privacy ? (doc.privacy as any).toObject() : {}),
        ...input,
      } as any;

      await doc.save();

      debugLog("UPDATE PRIVACY", "Privacy settings updated successfully.");

      return doc;
    },

    /* =======================================================
       UPDATE APPEARANCE
       ======================================================= */

    updateAppearance: async (_: any, { input }: any, context: any) => {
      debugLog("UPDATE APPEARANCE", "Appearance update request received.");

      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("UPDATE APPEARANCE", "User not found.");
        throw new Error("User not found.");
      }

      doc.appearance = {
        ...(doc.appearance ? (doc.appearance as any).toObject() : {}),
        ...input,
      } as any;

      await doc.save();

      debugLog(
        "UPDATE APPEARANCE",
        "Appearance settings updated successfully.",
      );

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
      debugLog("ONLINE STATUS", "Online status update received.", {
        isOnline,
      });

      const user = requireUser(context);

      const doc = await User.findById(toObjectId(user.id));

      if (!doc) {
        debugLog("ONLINE STATUS", "User not found.");
        throw new Error("User not found.");
      }

      doc.isOnline = isOnline;
      doc.lastSeen = new Date();

      await doc.save();

      debugLog("ONLINE STATUS", "Online status updated successfully.");

      return doc;
    },
  },
};
