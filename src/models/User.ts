import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface PrivacySettings {
  profileVisibility: "public" | "private";
  showOnlineStatus: boolean;
  allowMessagesFrom: "everyone" | "followers" | "nobody";
  showAge: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
}

export interface IUser extends Document {
  fullName: string;
  username?: string;
  email: string;
  password: string;
  age?: number;
  bio?: string;
  location?: string;
  profileImage?: string;
  isVerified: boolean;
  interests: string[];
  isOnline: boolean;
  lastSeen?: Date;
  blockedUsers?: Types.ObjectId[];
  privacy: PrivacySettings;
  appearance: AppearanceSettings;

  // Password reset fields
  resetPasswordOTP?: string;
  resetPasswordOTPExpires?: Date;
  resetPasswordOTPAttempts: number;
  resetPasswordLastSentAt?: Date;
  resetPasswordToken?: string;
  resetPasswordTokenExpires?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const privacySchema = new Schema<PrivacySettings>(
  {
    profileVisibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    showOnlineStatus: {
      type: Boolean,
      default: true,
    },
    allowMessagesFrom: {
      type: String,
      enum: ["everyone", "followers", "nobody"],
      default: "everyone",
    },
    showAge: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const appearanceSchema = new Schema<AppearanceSettings>(
  {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    accentColor: {
      type: String,
      default: "#2563eb",
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

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

    age: {
      type: Number,
      min: 13,
      max: 120,
    },

    bio: {
      type: String,
      maxlength: 500,
    },

    location: {
      type: String,
      trim: true,
      index: true,
    },

    profileImage: {
      type: String,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    interests: {
      type: [String],
      default: [],
    },

    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastSeen: {
      type: Date,
    },

    blockedUsers: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    privacy: {
      type: privacySchema,
      default: () => ({}),
    },

    appearance: {
      type: appearanceSchema,
      default: () => ({}),
    },

    // Password reset fields
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

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ location: 1, isOnline: 1 });

userSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
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

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
