import { Types } from 'mongoose';
import { User } from '../../models/User';
import { Follow } from '../../models/Follow';
import { Like } from '../../models/Like';
import { Post } from '../../models/Post';
import { SavedPost } from '../../models/SavedPost';
import { ProfileLike } from '../../models/ProfileLike';

export const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);

export const isValidId = (id: string): boolean => Types.ObjectId.isValid(id);

export const getFollowersCount = async (userId: string): Promise<number> => {
  return Follow.countDocuments({ followingId: toObjectId(userId) });
};

export const getFollowingCount = async (userId: string): Promise<number> => {
  return Follow.countDocuments({ followerId: toObjectId(userId) });
};

export const getLikesCount = async (userId: string): Promise<number> => {
  // Number of likes received across all of the user's posts.
  const posts = await Post.find({ authorId: toObjectId(userId) }).select('_id').lean();
  const ids = posts.map((p) => p._id);
  if (!ids.length) return 0;
  return Like.countDocuments({ postId: { $in: ids } });
};

export const getPostsCount = async (userId: string): Promise<number> => {
  return Post.countDocuments({ authorId: toObjectId(userId) });
};

export const isFollowing = async (followerId: string, followingId: string): Promise<boolean> => {
  if (followerId === followingId) return false;
  const doc = await Follow.findOne({
    followerId: toObjectId(followerId),
    followingId: toObjectId(followingId),
  })
    .lean()
    .select('_id');
  return !!doc;
};

export const isPostLiked = async (userId: string, postId: string): Promise<boolean> => {
  const doc = await Like.findOne({
    userId: toObjectId(userId),
    postId: toObjectId(postId),
  })
    .lean()
    .select('_id');
  return !!doc;
};

export const isPostSaved = async (userId: string, postId: string): Promise<boolean> => {
  const doc = await SavedPost.findOne({
    userId: toObjectId(userId),
    postId: toObjectId(postId),
  })
    .lean()
    .select('_id');
  return !!doc;
};

export const getPostLikesCount = async (postId: string): Promise<number> => {
  return Like.countDocuments({ postId: toObjectId(postId) });
};

// Has the current user already liked/passed this profile (dating)?
export const getProfileDecision = async (
  fromUserId: string,
  toUserId: string
): Promise<'like' | 'pass' | null> => {
  const doc = await ProfileLike.findOne({
    fromUserId: toObjectId(fromUserId),
    toUserId: toObjectId(toUserId),
  })
    .lean()
    .select('action');
  return doc ? (doc.action as 'like' | 'pass') : null;
};

// Fetch a user document by id (without password).
export const fetchUser = async (id: string) => {
  return User.findById(toObjectId(id));
};
