"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUser = exports.getProfileDecision = exports.getPostLikesCount = exports.isPostSaved = exports.isPostLiked = exports.isFollowing = exports.getPostsCount = exports.getLikesCount = exports.getFollowingCount = exports.getFollowersCount = exports.isValidId = exports.toObjectId = void 0;
const mongoose_1 = require("mongoose");
const User_1 = require("../../models/User");
const Follow_1 = require("../../models/Follow");
const Like_1 = require("../../models/Like");
const Post_1 = require("../../models/Post");
const SavedPost_1 = require("../../models/SavedPost");
const ProfileLike_1 = require("../../models/ProfileLike");
const toObjectId = (id) => new mongoose_1.Types.ObjectId(id);
exports.toObjectId = toObjectId;
const isValidId = (id) => mongoose_1.Types.ObjectId.isValid(id);
exports.isValidId = isValidId;
const getFollowersCount = async (userId) => {
    return Follow_1.Follow.countDocuments({ followingId: (0, exports.toObjectId)(userId) });
};
exports.getFollowersCount = getFollowersCount;
const getFollowingCount = async (userId) => {
    return Follow_1.Follow.countDocuments({ followerId: (0, exports.toObjectId)(userId) });
};
exports.getFollowingCount = getFollowingCount;
const getLikesCount = async (userId) => {
    // Number of likes received across all of the user's posts.
    const posts = await Post_1.Post.find({ authorId: (0, exports.toObjectId)(userId) }).select('_id').lean();
    const ids = posts.map((p) => p._id);
    if (!ids.length)
        return 0;
    return Like_1.Like.countDocuments({ postId: { $in: ids } });
};
exports.getLikesCount = getLikesCount;
const getPostsCount = async (userId) => {
    return Post_1.Post.countDocuments({ authorId: (0, exports.toObjectId)(userId) });
};
exports.getPostsCount = getPostsCount;
const isFollowing = async (followerId, followingId) => {
    if (followerId === followingId)
        return false;
    const doc = await Follow_1.Follow.findOne({
        followerId: (0, exports.toObjectId)(followerId),
        followingId: (0, exports.toObjectId)(followingId),
    })
        .lean()
        .select('_id');
    return !!doc;
};
exports.isFollowing = isFollowing;
const isPostLiked = async (userId, postId) => {
    const doc = await Like_1.Like.findOne({
        userId: (0, exports.toObjectId)(userId),
        postId: (0, exports.toObjectId)(postId),
    })
        .lean()
        .select('_id');
    return !!doc;
};
exports.isPostLiked = isPostLiked;
const isPostSaved = async (userId, postId) => {
    const doc = await SavedPost_1.SavedPost.findOne({
        userId: (0, exports.toObjectId)(userId),
        postId: (0, exports.toObjectId)(postId),
    })
        .lean()
        .select('_id');
    return !!doc;
};
exports.isPostSaved = isPostSaved;
const getPostLikesCount = async (postId) => {
    return Like_1.Like.countDocuments({ postId: (0, exports.toObjectId)(postId) });
};
exports.getPostLikesCount = getPostLikesCount;
// Has the current user already liked/passed this profile (dating)?
const getProfileDecision = async (fromUserId, toUserId) => {
    const doc = await ProfileLike_1.ProfileLike.findOne({
        fromUserId: (0, exports.toObjectId)(fromUserId),
        toUserId: (0, exports.toObjectId)(toUserId),
    })
        .lean()
        .select('action');
    return doc ? doc.action : null;
};
exports.getProfileDecision = getProfileDecision;
// Fetch a user document by id (without password).
const fetchUser = async (id) => {
    return User_1.User.findById((0, exports.toObjectId)(id));
};
exports.fetchUser = fetchUser;
//# sourceMappingURL=helpers.js.map