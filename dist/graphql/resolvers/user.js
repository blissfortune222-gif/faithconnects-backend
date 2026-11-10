"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const mongoose_1 = require("mongoose");
const User_1 = require("../../models/User");
const auth_1 = require("../../middleware/auth");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const helpers_1 = require("./helpers");
const compatibility_1 = require("../../utils/compatibility");
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password.length >= 6;
exports.userResolvers = {
    User: {
        followersCount: (parent) => (0, helpers_1.getFollowersCount)(String(parent._id)),
        followingCount: (parent) => (0, helpers_1.getFollowingCount)(String(parent._id)),
        likesCount: (parent) => (0, helpers_1.getLikesCount)(String(parent._id)),
        postsCount: (parent) => (0, helpers_1.getPostsCount)(String(parent._id)),
        compatibility: (parent) => {
            // Only populated when the viewer is set on the parent (discover/profile).
            if (!parent._compatibilityViewerInterests)
                return null;
            const score = (0, compatibility_1.calculateCompatibility)(parent._compatibilityViewerInterests, parent.interests || []);
            const shared = (0, compatibility_1.sharedInterests)(parent._compatibilityViewerInterests, parent.interests || []);
            return { score, sharedInterests: shared };
        },
    },
    Query: {
        me: async (_, __, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            return doc;
        },
        user: async (_, { id }, context) => {
            if (!mongoose_1.Types.ObjectId.isValid(id))
                throw new Error('Invalid user id.');
            const doc = await User_1.User.findById(id);
            if (!doc)
                throw new Error('User not found.');
            const viewer = context.user;
            // Respect privacy: private profiles are only visible to self or followers.
            if (viewer && String(doc._id) === viewer.id)
                return doc;
            if (doc.privacy?.profileVisibility === 'private') {
                if (!viewer)
                    throw new Error('This profile is private.');
                const canSee = await (0, helpers_1.isFollowing)(viewer.id, String(doc._id));
                if (!canSee)
                    throw new Error('This profile is private.');
            }
            if (viewer) {
                doc._compatibilityViewerInterests = (await User_1.User.findById(viewer.id).select('interests'))?.interests || [];
            }
            return doc;
        },
        users: async (_, { limit, offset }, context) => {
            (0, auth_1.requireUser)(context);
            const docs = await User_1.User.find().sort({ createdAt: -1 }).skip(offset).limit(limit);
            return docs;
        },
        discoverNearby: async (_, { limit, offset }, context) => {
            const viewer = (0, auth_1.requireUser)(context);
            const me = await User_1.User.findById((0, helpers_1.toObjectId)(viewer.id)).select('location interests');
            const query = { _id: { $ne: (0, helpers_1.toObjectId)(viewer.id) } };
            if (me?.location)
                query.location = me.location;
            const docs = await User_1.User.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);
            docs.forEach((d) => (d._compatibilityViewerInterests = me?.interests || []));
            return docs;
        },
        discoverNew: async (_, { limit, offset }, context) => {
            const viewer = (0, auth_1.requireUser)(context);
            const me = await User_1.User.findById((0, helpers_1.toObjectId)(viewer.id)).select('interests');
            const docs = await User_1.User.find({ _id: { $ne: (0, helpers_1.toObjectId)(viewer.id) } })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
            docs.forEach((d) => (d._compatibilityViewerInterests = me?.interests || []));
            return docs;
        },
        discoverOnline: async (_, { limit, offset }, context) => {
            const viewer = (0, auth_1.requireUser)(context);
            const me = await User_1.User.findById((0, helpers_1.toObjectId)(viewer.id)).select('interests');
            const docs = await User_1.User.find({
                _id: { $ne: (0, helpers_1.toObjectId)(viewer.id) },
                isOnline: true,
                'privacy.showOnlineStatus': true,
            })
                .sort({ lastSeen: -1 })
                .skip(offset)
                .limit(limit);
            docs.forEach((d) => (d._compatibilityViewerInterests = me?.interests || []));
            return docs;
        },
        discoverVerified: async (_, { limit, offset }, context) => {
            const viewer = (0, auth_1.requireUser)(context);
            const me = await User_1.User.findById((0, helpers_1.toObjectId)(viewer.id)).select('interests');
            const docs = await User_1.User.find({
                _id: { $ne: (0, helpers_1.toObjectId)(viewer.id) },
                isVerified: true,
            })
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit);
            docs.forEach((d) => (d._compatibilityViewerInterests = me?.interests || []));
            return docs;
        },
    },
    Mutation: {
        signup: async (_, { fullName, email, password }) => {
            if (!fullName || !fullName.trim())
                throw new Error('Full name is required.');
            if (!validateEmail(email))
                throw new Error('Invalid email.');
            if (!validatePassword(password))
                throw new Error('Password must be at least 6 characters.');
            const normalized = email.toLowerCase().trim();
            const existing = await User_1.User.findOne({ email: normalized });
            if (existing)
                throw new Error('A user with this email already exists.');
            const hashed = await (0, password_1.hashPassword)(password);
            const doc = await User_1.User.create({
                fullName: fullName.trim(),
                email: normalized,
                password: hashed,
            });
            const token = (0, jwt_1.signToken)({ id: String(doc._id), email: doc.email });
            return { token, user: doc };
        },
        login: async (_, { email, password }) => {
            const normalized = email.toLowerCase().trim();
            const doc = await User_1.User.findOne({ email: normalized }).select('+password');
            if (!doc)
                throw new Error('Invalid credentials.');
            const ok = await (0, password_1.comparePassword)(password, doc.password);
            if (!ok)
                throw new Error('Invalid credentials.');
            const token = (0, jwt_1.signToken)({ id: String(doc._id), email: doc.email });
            // Strip password before returning.
            doc.password = undefined;
            return { token, user: doc };
        },
        updateProfile: async (_, { input }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            if (input.username !== undefined) {
                const candidate = String(input.username).toLowerCase().trim();
                if (candidate) {
                    const clash = await User_1.User.findOne({ username: candidate, _id: { $ne: doc._id } });
                    if (clash)
                        throw new Error('Username is already taken.');
                    doc.username = candidate;
                }
                else {
                    doc.username = undefined;
                }
            }
            if (input.fullName !== undefined) {
                if (!input.fullName.trim())
                    throw new Error('Full name cannot be empty.');
                doc.fullName = input.fullName.trim();
            }
            if (input.age !== undefined)
                doc.age = input.age;
            if (input.bio !== undefined)
                doc.bio = input.bio;
            if (input.location !== undefined)
                doc.location = input.location;
            if (input.profileImage !== undefined)
                doc.profileImage = input.profileImage;
            if (input.interests !== undefined)
                doc.interests = input.interests;
            await doc.save();
            return doc;
        },
        updateInterests: async (_, { interests }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            doc.interests = interests;
            await doc.save();
            return doc;
        },
        updatePrivacy: async (_, { input }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            doc.privacy = { ...doc.privacy.toObject(), ...input };
            await doc.save();
            return doc;
        },
        updateAppearance: async (_, { input }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            doc.appearance = { ...doc.appearance.toObject(), ...input };
            await doc.save();
            return doc;
        },
        setOnlineStatus: async (_, { isOnline }, context) => {
            const user = (0, auth_1.requireUser)(context);
            const doc = await User_1.User.findById((0, helpers_1.toObjectId)(user.id));
            if (!doc)
                throw new Error('User not found.');
            doc.isOnline = isOnline;
            doc.lastSeen = new Date();
            await doc.save();
            return doc;
        },
    },
};
//# sourceMappingURL=user.js.map