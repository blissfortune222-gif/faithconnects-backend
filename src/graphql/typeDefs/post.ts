export const postTypes = /* GraphQL */ `
  type Media {
    url: String!
    type: String!
  }

  type Comment {
    id: ID!
    postId: ID!
    authorId: ID!
    text: String!
    author: User!
    createdAt: DateTime!
    updatedAt: DateTime!
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

    postComments(postId: ID!, limit: Int = 20, offset: Int = 0): [Comment!]!
  }

  extend type Mutation {
    createPost(input: CreatePostInput!): Post!

    updatePost(id: ID!, input: UpdatePostInput!): Post!

    deletePost(id: ID!): Boolean!

    likePost(postId: ID!): Post!

    unlikePost(postId: ID!): Post!

    savePost(postId: ID!): Boolean!

    unsavePost(postId: ID!): Boolean!

    createComment(postId: ID!, text: String!): Comment!

    deleteComment(id: ID!): Boolean!
  }
`;
