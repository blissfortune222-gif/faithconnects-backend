"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postResolvers = void 0;
const Post_1 = require("../../models/Post");
const Like_1 = require("../../models/Like");
const SavedPost_1 = require("../../models/SavedPost");
const User_1 = require("../../models/User");
const Notification_1 = require("../../models/Notification");
const auth_1 = require("../../middleware/auth");
const helpers_1 = require("./helpers");
exports.postResolvers = {
    Post: {
        author: (parent) => User_1.User.findById(parent.authorId),
        isLiked: (parent, _, context) => context.user ? (0, helpers_1.isPostLiked)(context.user.id, String(parent._id)) : false,
        isSaved: (parent, _, context) => context.user ? (0, helpers_1.isPostSaved)(context.user.id, String(parent._id)) : false,
        likesCount: (parent) => (0, helpers_1.getPostLikesCount)(String(parent._id)),
        commentsCount: () => 0, // comments not implemented in this phase
    },
    Query: {
        posts: async (_, { limit, offset }, context) => {
            (0, auth_1.requireUser)(context);
            return Post_1.Post.find().sort({ createdAt: -1 }).skip(offset).limit(limit);
        },
        post: async (_, { id }, context) => {
            (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(id))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(id);
            if (!post)
                throw new Error('Post not found.');
            return post;
        },
        userPosts: async (_, { userId, limit, offset }, context) => {
            (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(userId))
                throw new Error('Invalid user id.');
            return Post_1.Post.find({ authorId: (0, helpers_1.toObjectId)(userId) })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
        },
        savedPosts: async (_, { limit, offset }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const saved = await SavedPost_1.SavedPost.find({ userId: (0, helpers_1.toObjectId)(user.id) })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
            const postIds = saved.map((s) => s.postId);
            if (!postIds.length)
                return [];
            // Preserve order of saved records.
            const posts = await Post_1.Post.find({ _id: { $in: postIds } });
            const byId = new Map(posts.map((p) => [String(p._id), p]));
            return postIds.map((id) => byId.get(String(id))).filter(Boolean);
        },
    },
    Mutation: {
        createPost: async (_, { input }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!input.caption && (!input.media || !input.media.length)) {
                throw new Error('A post must have a caption or media.');
            }
            const media = (input.media || []).map((m) => ({
                url: m.url,
                type: m.type || 'image',
            }));
            const post = await Post_1.Post.create({
                authorId: (0, helpers_1.toObjectId)(user.id),
                caption: input.caption || '',
                media,
            });
            return post;
        },
        updatePost: async (_, { id, input }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(id))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(id);
            if (!post)
                throw new Error('Post not found.');
            if (String(post.authorId) !== user.id) {
                throw new Error('Unauthorized: you can only edit your own posts.');
            }
            if (input.caption !== undefined)
                post.caption = input.caption;
            if (input.media !== undefined) {
                post.media = input.media.map((m) => ({ url: m.url, type: m.type || 'image' }));
            }
            await post.save();
            return post;
        },
        deletePost: async (_, { id }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(id))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(id);
            if (!post)
                throw new Error('Post not found.');
            if (String(post.authorId) !== user.id) {
                throw new Error('Unauthorized: you can only delete your own posts.');
            }
            await post.deleteOne();
            // Clean up dependent likes and saves.
            await Like_1.Like.deleteMany({ postId: (0, helpers_1.toObjectId)(id) });
            await SavedPost_1.SavedPost.deleteMany({ postId: (0, helpers_1.toObjectId)(id) });
            return true;
        },
        likePost: async (_, { postId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(postId))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(postId);
            if (!post)
                throw new Error('Post not found.');
            const existing = await Like_1.Like.findOne({
                userId: (0, helpers_1.toObjectId)(user.id),
                postId: (0, helpers_1.toObjectId)(postId),
            });
            if (existing)
                throw new Error('You have already liked this post.');
            await Like_1.Like.create({ userId: (0, helpers_1.toObjectId)(user.id), postId: (0, helpers_1.toObjectId)(postId) });
            if (String(post.authorId) !== user.id) {
                await Notification_1.Notification.create({
                    recipientId: post.authorId,
                    senderId: (0, helpers_1.toObjectId)(user.id),
                    type: 'LIKE',
                    referenceId: (0, helpers_1.toObjectId)(postId),
                    message: 'liked your post.',
                });
            }
            return post;
        },
        unlikePost: async (_, { postId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(postId))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(postId);
            if (!post)
                throw new Error('Post not found.');
            await Like_1.Like.deleteOne({ userId: (0, helpers_1.toObjectId)(user.id), postId: (0, helpers_1.toObjectId)(postId) });
            return post;
        },
        savePost: async (_, { postId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(postId))
                throw new Error('Invalid post id.');
            const post = await Post_1.Post.findById(postId);
            if (!post)
                throw new Error('Post not found.');
            const existing = await SavedPost_1.SavedPost.findOne({
                userId: (0, helpers_1.toObjectId)(user.id),
                postId: (0, helpers_1.toObjectId)(postId),
            });
            if (existing)
                throw new Error('Post already saved.');
            await SavedPost_1.SavedPost.create({ userId: (0, helpers_1.toObjectId)(user.id), postId: (0, helpers_1.toObjectId)(postId) });
            return true;
        },
        unsavePost: async (_, { postId }, context) => {
            const user = (0, auth_1.requireUser)(context);
            if (!(0, helpers_1.isValidId)(postId))
                throw new Error('Invalid post id.');
            await SavedPost_1.SavedPost.deleteOne({ userId: (0, helpers_1.toObjectId)(user.id), postId: (0, helpers_1.toObjectId)(postId) });
            return true;
        },
    },
};
//# sourceMappingURL=post.js.map