import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMedia {
  url: string;
  type: 'image' | 'video';
}

export interface IPost extends Document {
  authorId: mongoose.Types.ObjectId;
  caption: string;
  media: IMedia[];
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { _id: false }
);

const postSchema = new Schema<IPost>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    caption: { type: String, maxlength: 2200 },
    media: { type: [mediaSchema], default: [] },
  },
  { timestamps: true }
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

export const Post: Model<IPost> = mongoose.model<IPost>('Post', postSchema);
