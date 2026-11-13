import mongoose, { Schema } from "mongoose";

const privacySchema = new Schema(
  {
    profileVisibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    showOnlineStatus: { type: Boolean, default: true },
    allowMessagesFrom: {
      type: String,
      enum: ["everyone", "followers", "nobody"],
      default: "everyone",
    },
    showAge: { type: Boolean, default: true },
  },
  { _id: false },
);

const appearanceSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    accentColor: { type: String, default: "#2563eb" },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    // PASSWORD RESET OTP
    resetPasswordOTP: {
      type: String,
      select: false,
    },

    resetPasswordOTPExpires: {
      type: Date,
      select: false,
    },

    resetPasswordOTPAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    resetPasswordLastSentAt: {
      type: Date,
      select: false,
    },

    // Temporary authorization after successful OTP verification.
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordTokenExpires: {
      type: Date,
      select: false,
    },

    age: { type: Number, min: 13, max: 120 },

    bio: { type: String, maxlength: 500 },

    location: { type: String, trim: true, index: true },

    profileImage: { type: String },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    interests: {
      type: [String],
      default: [],
    },

    // Store IDs of users blocked by this user.
    blockedUsers: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastSeen: { type: Date },

    privacy: {
      type: privacySchema,
      default: () => ({}),
    },

    appearance: {
      type: appearanceSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

// INDEXES
userSchema.index({ createdAt: -1 });
userSchema.index({ location: 1, isOnline: 1 });

// Never return sensitive authentication fields in JSON.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.resetPasswordOTP;
    delete ret.resetPasswordOTPExpires;
    delete ret.resetPasswordOTPAttempts;
    delete ret.resetPasswordLastSentAt;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordTokenExpires;

    return ret;
  },
});

export const User = mongoose.model("User", userSchema);
