"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTypes = void 0;
exports.postTypes = `
  type Media {
    url: String!
    type: String!
  }

  type Post {
    id: ID!
    author: User!
    authorId: ID!
    caption: String
    media: [Media!]!
    likesCount: Int!
    commentsCount: Int!
    isLiked: Boolean!
    isSaved: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input MediaInput {
    url: String!
    type: String
  }

  input CreatePostInput {
    caption: String
    media: [MediaInput!]!
  }

  input UpdatePostInput {
    caption: String
    media: [MediaInput!]
  }

  extend type Query {
    posts(limit: Int = 20, offset: Int = 0): [Post!]!
    post(id: ID!): Post
    userPosts(userId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!
    savedPosts(limit: Int = 20, offset: Int = 0): [Post!]!
  }

  extend type Mutation {
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
    likePost(postId: ID!): Post!
    unlikePost(postId: ID!): Post!
    savePost(postId: ID!): Boolean!
    unsavePost(postId: ID!): Boolean!
  }
`;
//# sourceMappingURL=post.js.map