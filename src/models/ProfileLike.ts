import mongoose, { Schema, Document, Model } from 'mongoose';

// A "profile like" is a dating/matching action (like/pass), distinct from post likes.
export interface IProfileLike extends Document {
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  action: 'like' | 'pass';
  createdAt: Date;
}

const profileLikeSchema = new Schema<IProfileLike>(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['like', 'pass'], required: true },
  },
  { timestamps: true }
);

// One decision per user-pair (regardless of direction is NOT enforced here —
// each user can make their own decision about the other).
profileLikeSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
profileLikeSchema.index({ toUserId: 1, action: 1 });

export const ProfileLike: Model<IProfileLike> = mongoose.model<IProfileLike>(
  'ProfileLike',
  profileLikeSchema
);
