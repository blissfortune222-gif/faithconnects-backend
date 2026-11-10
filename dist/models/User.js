"use strict";

var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        o[k2] = m[k];
      });

var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });

var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function () {
      ownKeys =
        Object.getOwnPropertyNames ||
        function () {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys;
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();

Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;

const mongoose_1 = __importStar(require("mongoose"));

const privacySchema = new mongoose_1.Schema(
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

const appearanceSchema = new mongoose_1.Schema(
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

const userSchema = new mongoose_1.Schema(
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
    password: { type: String, required: true, select: false },
    age: { type: Number, min: 13, max: 120 },
    bio: { type: String, maxlength: 500 },
    location: { type: String, trim: true, index: true },
    profileImage: { type: String },
    isVerified: { type: Boolean, default: false, index: true },
    interests: { type: [String], default: [] },

    // Store IDs of users blocked by this user.
    blockedUsers: {
      type: [
        {
          type: mongoose_1.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date },
    privacy: { type: privacySchema, default: () => ({}) },
    appearance: { type: appearanceSchema, default: () => ({}) },
  },
  { timestamps: true },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ location: 1, isOnline: 1 });

// Never return the password hash in toJSON.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

exports.User = mongoose_1.default.model("User", userSchema);

//# sourceMappingURL=User.js.map
