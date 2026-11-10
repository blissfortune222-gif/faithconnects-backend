import { Post, IPost } from "../../models/Post";
import { Comment, IComment } from "../../models/comments";
import { Like } from "../../models/Like";
import { SavedPost } from "../../models/SavedPost";
import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { requireUser } from "../../middleware/auth";
import { Types } from "mongoose";
import {
  toObjectId,
  isValidId,
  isPostLiked,
  isPostSaved,
  getPostLikesCount,
} from "./helpers";

/* =========================================================
   BLOCKING HELPERS
========================================================= */

const getBlockedUserIds = async (userId: string): Promise<Types.ObjectId[]> => {
  const user = await User.findById(userId).select("blockedUsers").exec();

  if (!user) {
    throw new Error("Authenticated user not found.");
  }

  return (user.blockedUsers ?? []).map(
    (id: any) => new Types.ObjectId(String(id)),
  );
};

const isBlockedAuthor = (
  authorId: unknown,
  blockedUserIds: Types.ObjectId[],
): boolean => {
  const authorIdString = String(authorId);

  return blockedUserIds.some(
    (blockedId) => String(blockedId) === authorIdString,
  );
};

const assertPostVisible = async (
  post: IPost,
  currentUserId: string,
): Promise<void> => {
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  if (isBlockedAuthor(post.authorId, blockedUserIds)) {
    throw new Error("This post is unavailable.");
  }
};

/* =========================================================
   POST AND COMMENT FIELD RESOLVERS
========================================================= */

export const postResolvers = {
  Post: {
    author: async (parent: IPost, _: any, context: any) => {
      const author = await User.findById(parent.authorId).exec();

      if (!author) {
        throw new Error("Post author not found.");
      }

      if (context.user) {
        const blockedUserIds = await getBlockedUserIds(String(context.user.id));

        if (isBlockedAuthor(author._id, blockedUserIds)) {
          return null;
        }
      }

      return author;
    },

    isLiked: async (parent: IPost, _: any, context: any) => {
      if (!context.user) return false;

      return isPostLiked(context.user.id, String(parent._id));
    },

    isSaved: async (parent: IPost, _: any, context: any) => {
      if (!context.user) return false;

      return isPostSaved(context.user.id, String(parent._id));
    },

    likesCount: async (parent: IPost) => {
      return getPostLikesCount(String(parent._id));
    },

    commentsCount: async (parent: IPost, _: any, context: any) => {
      if (context.user) {
        const blockedUserIds = await getBlockedUserIds(String(context.user.id));

        return Comment.countDocuments({
          postId: parent._id,
          authorId: { $nin: blockedUserIds },
        });
      }

      return Comment.countDocuments({
        postId: parent._id,
      });
    },
  },

  Comment: {
    author: async (parent: IComment, _: any, context: any) => {
      const authorId = String(parent.authorId);

      if (!isValidId(authorId)) {
        throw new Error(`Invalid comment author ID: ${authorId}`);
      }

      const author = await User.findById(authorId).exec();

      if (!author) {
        throw new Error(`Comment author not found for authorId: ${authorId}`);
      }

      if (context.user) {
        const blockedUserIds = await getBlockedUserIds(String(context.user.id));

        if (isBlockedAuthor(author._id, blockedUserIds)) {
          return null;
        }
      }

      return author;
    },
  },

  /* =========================================================
     QUERIES
  ========================================================= */

  Query: {
    /* -------------------- FEED POSTS -------------------- */

    posts: async (
      _: any,
      {
        limit = 20,
        offset = 0,
      }: {
        limit: number;
        offset: number;
      },
      context: any,
    ) => {
      console.log("📥 POSTS QUERY STARTED");

      const currentUser = requireUser(context);
      const blockedUserIds = await getBlockedUserIds(String(currentUser.id));

      const posts = await Post.find({
        authorId: { $nin: blockedUserIds },
      })
        .sort({ createdAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(Math.max(1, limit), 100))
        .exec();

      console.log("🚫 Blocked user IDs:", blockedUserIds.map(String));
      console.log("📊 Posts returned:", posts.length);

      return posts;
    },

    /* -------------------- SINGLE POST -------------------- */

    post: async (_: any, { id }: { id: string }, context: any) => {
      const currentUser = requireUser(context);

      if (!isValidId(id)) {
        throw new Error("Invalid post id.");
      }

      const blockedUserIds = await getBlockedUserIds(String(currentUser.id));

      const post = await Post.findOne({
        _id: toObjectId(id),
        authorId: { $nin: blockedUserIds },
      }).exec();

      if (!post) {
        throw new Error("Post not found or unavailable.");
      }

      return post;
    },

    /* -------------------- USER POSTS -------------------- */

    userPosts: async (
      _: any,
      {
        userId,
        limit = 20,
        offset = 0,
      }: {
        userId: string;
        limit: number;
        offset: number;
      },
      context: any,
    ) => {
      const currentUser = requireUser(context);

      if (!isValidId(userId)) {
        throw new Error("Invalid user id.");
      }

      const blockedUserIds = await getBlockedUserIds(String(currentUser.id));

      if (isBlockedAuthor(userId, blockedUserIds)) {
        return [];
      }

      return Post.find({
        authorId: toObjectId(userId),
      })
        .sort({ createdAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(Math.max(1, limit), 100))
        .exec();
    },

    /* -------------------- SAVED POSTS -------------------- */

    savedPosts: async (
      _: any,
      {
        limit = 20,
        offset = 0,
      }: {
        limit: number;
        offset: number;
      },
      context: any,
    ) => {
      const currentUser = requireUser(context);

      const blockedUserIds = await getBlockedUserIds(String(currentUser.id));

      const saved = await SavedPost.find({
        userId: toObjectId(currentUser.id),
      })
        .sort({ createdAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(Math.max(1, limit), 100))
        .exec();

      const postIds = saved.map((item) => item.postId);

      if (!postIds.length) return [];

      const posts = await Post.find({
        _id: { $in: postIds },
        authorId: { $nin: blockedUserIds },
      }).exec();

      const postsById = new Map(posts.map((post) => [String(post._id), post]));

      return postIds
        .map((id) => postsById.get(String(id)))
        .filter(Boolean) as IPost[];
    },

    /* -------------------- POST COMMENTS -------------------- */

    postComments: async (
      _: any,
      {
        postId,
        limit = 50,
        offset = 0,
      }: {
        postId: string;
        limit: number;
        offset: number;
      },
      context: any,
    ) => {
      const currentUser = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const blockedUserIds = await getBlockedUserIds(String(currentUser.id));

      // Do not expose comments on a blocked user's post.
      const post = await Post.findOne({
        _id: toObjectId(postId),
        authorId: { $nin: blockedUserIds },
      }).exec();

      if (!post) {
        throw new Error("Post not found or unavailable.");
      }

      // Exclude comments written by blocked accounts.
      return Comment.find({
        postId: toObjectId(postId),
        authorId: { $nin: blockedUserIds },
      })
        .sort({ createdAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(Math.max(1, limit), 100))
        .exec();
    },
  },

  /* =========================================================
     MUTATIONS
  ========================================================= */

  Mutation: {
    /* -------------------- CREATE POST -------------------- */

    createPost: async (_: any, { input }: any, context: any) => {
      const user = requireUser(context);

      const caption =
        typeof input.caption === "string" ? input.caption.trim() : "";

      const incomingMedia = Array.isArray(input.media) ? input.media : [];

      if (!caption && incomingMedia.length === 0) {
        throw new Error("A post must have a caption or media.");
      }

      const media = incomingMedia
        .filter(
          (item: any) =>
            item && typeof item.url === "string" && item.url.trim().length > 0,
        )
        .map((item: any) => ({
          url: item.url.trim(),
          type:
            typeof item.type === "string" && item.type.trim()
              ? item.type.trim()
              : "image",
        }));

      return Post.create({
        authorId: toObjectId(user.id),
        caption,
        media,
      });
    },

    /* -------------------- UPDATE POST -------------------- */

    updatePost: async (
      _: any,
      {
        id,
        input,
      }: {
        id: string;
        input: any;
      },
      context: any,
    ) => {
      const user = requireUser(context);

      if (!isValidId(id)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(id).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      if (String(post.authorId) !== String(user.id)) {
        throw new Error("Unauthorized: you can only edit your own posts.");
      }

      if (input.caption !== undefined) {
        post.caption =
          typeof input.caption === "string" ? input.caption.trim() : "";
      }

      if (input.media !== undefined) {
        const incomingMedia = Array.isArray(input.media) ? input.media : [];

        post.media = incomingMedia
          .filter(
            (item: any) =>
              item &&
              typeof item.url === "string" &&
              item.url.trim().length > 0,
          )
          .map((item: any) => ({
            url: item.url.trim(),
            type:
              typeof item.type === "string" && item.type.trim()
                ? item.type.trim()
                : "image",
          }));
      }

      const finalCaption =
        typeof post.caption === "string" ? post.caption.trim() : "";

      const finalMedia = Array.isArray(post.media) ? post.media : [];

      if (!finalCaption && finalMedia.length === 0) {
        throw new Error("A post must have a caption or media.");
      }

      await post.save();

      return post;
    },

    /* -------------------- DELETE POST -------------------- */

    deletePost: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireUser(context);

      if (!isValidId(id)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(id).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      if (String(post.authorId) !== String(user.id)) {
        throw new Error("Unauthorized: you can only delete your own posts.");
      }

      await post.deleteOne();

      await Like.deleteMany({
        postId: toObjectId(id),
      });

      await SavedPost.deleteMany({
        postId: toObjectId(id),
      });

      await Comment.deleteMany({
        postId: toObjectId(id),
      });

      return true;
    },

    /* -------------------- LIKE POST -------------------- */

    likePost: async (_: any, { postId }: { postId: string }, context: any) => {
      const user = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(postId).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      await assertPostVisible(post, String(user.id));

      const existing = await Like.findOne({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      }).exec();

      if (existing) {
        throw new Error("You have already liked this post.");
      }

      await Like.create({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      });

      if (String(post.authorId) !== String(user.id)) {
        await Notification.create({
          recipientId: post.authorId,
          senderId: toObjectId(user.id),
          type: "LIKE",
          referenceId: toObjectId(postId),
          message: "liked your post.",
        });
      }

      return post;
    },

    /* -------------------- UNLIKE POST -------------------- */

    unlikePost: async (
      _: any,
      { postId }: { postId: string },
      context: any,
    ) => {
      const user = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(postId).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      await assertPostVisible(post, String(user.id));

      await Like.deleteOne({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      });

      return post;
    },

    /* -------------------- SAVE POST -------------------- */

    savePost: async (_: any, { postId }: { postId: string }, context: any) => {
      const user = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(postId).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      await assertPostVisible(post, String(user.id));

      const existing = await SavedPost.findOne({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      }).exec();

      if (existing) {
        throw new Error("Post already saved.");
      }

      await SavedPost.create({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      });

      return true;
    },

    /* -------------------- UNSAVE POST -------------------- */

    unsavePost: async (
      _: any,
      { postId }: { postId: string },
      context: any,
    ) => {
      const user = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(postId).exec();

      if (post) {
        await assertPostVisible(post, String(user.id));
      }

      await SavedPost.deleteOne({
        userId: toObjectId(user.id),
        postId: toObjectId(postId),
      });

      return true;
    },

    /* -------------------- BLOCK USER -------------------- */

    blockUser: async (
      _: any,
      { userId }: { userId: string },
      context: any,
    ): Promise<boolean> => {
      console.log("🚫 BLOCK USER MUTATION STARTED");

      const currentUser = requireUser(context);
      const currentUserId = String(currentUser.id);

      if (!userId || !Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID.");
      }

      const targetUserId = new Types.ObjectId(userId);

      if (currentUserId === String(targetUserId)) {
        throw new Error("You cannot block yourself.");
      }

      const targetUser = await User.findById(targetUserId).select("_id").exec();

      if (!targetUser) {
        throw new Error("User not found.");
      }

      const updatedUser = await User.findByIdAndUpdate(
        currentUserId,
        {
          $addToSet: {
            blockedUsers: targetUser._id,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
        .select("_id blockedUsers")
        .exec();

      if (!updatedUser) {
        throw new Error("Could not update your blocked users.");
      }

      console.log("✅ User blocked:", String(targetUser._id));

      return true;
    },

    /* -------------------- CREATE COMMENT -------------------- */

    createComment: async (
      _: any,
      {
        postId,
        text,
      }: {
        postId: string;
        text: string;
      },
      context: any,
    ) => {
      const user = requireUser(context);

      if (!isValidId(postId)) {
        throw new Error("Invalid post id.");
      }

      const post = await Post.findById(postId).exec();

      if (!post) {
        throw new Error("Post not found.");
      }

      await assertPostVisible(post, String(user.id));

      const cleanText = typeof text === "string" ? text.trim() : "";

      if (!cleanText) {
        throw new Error("Comment cannot be empty.");
      }

      if (cleanText.length > 1000) {
        throw new Error("Comment cannot exceed 1000 characters.");
      }

      const author = await User.findById(user.id).exec();

      if (!author) {
        throw new Error(`Authenticated user not found: ${user.id}`);
      }

      const comment = await Comment.create({
        postId: toObjectId(postId),
        authorId: author._id,
        text: cleanText,
      });

      if (String(post.authorId) !== String(author._id)) {
        await Notification.create({
          recipientId: post.authorId,
          senderId: author._id,
          type: "COMMENT",
          referenceId: toObjectId(postId),
          message: "commented on your post.",
        });
      }

      return comment;
    },

    /* -------------------- DELETE COMMENT -------------------- */

    deleteComment: async (_: any, { id }: { id: string }, context: any) => {
      const user = requireUser(context);

      if (!isValidId(id)) {
        throw new Error("Invalid comment id.");
      }

      const comment = await Comment.findById(id).exec();

      if (!comment) {
        throw new Error("Comment not found.");
      }

      if (String(comment.authorId) !== String(user.id)) {
        throw new Error("Unauthorized: you can only delete your own comments.");
      }

      await comment.deleteOne();

      return true;
    },
  },
};
