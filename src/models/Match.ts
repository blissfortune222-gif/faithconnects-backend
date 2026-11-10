import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMatch extends Document {
  user1: mongoose.Types.ObjectId;
  user2: mongoose.Types.ObjectId;
  matchedAt: Date;
  conversationId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema<IMatch>(
  {
    user1: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    matchedAt: { type: Date, default: Date.now },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  },
  { timestamps: true }
);

// Ensure a unique match between two users regardless of order.
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });
matchSchema.index({ user1: 1 });
matchSchema.index({ user2: 1 });

export const Match: Model<IMatch> = mongoose.model<IMatch>('Match', matchSchema);
