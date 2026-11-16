export const postTypes = /* GraphQL */ `
  type Media {
    url: String!
    type: String!
  }

  type Comment {
    id: ID!
    postId: ID!
    authorId: ID!
    author: User

    text: String!

    # Reply relationship
    parentCommentId: ID
    parentComment: Comment
    replies: [Comment!]!

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
    # Feed posts
    posts(limit: Int = 20, offset: Int = 0): [Post!]!

    # Single post
    post(id: ID!): Post

    # Posts belonging to a user
    userPosts(userId: ID!, limit: Int = 20, offset: Int = 0): [Post!]!

    # Saved posts
    savedPosts(limit: Int = 20, offset: Int = 0): [Post!]!

    # Post comments
    postComments(postId: ID!, limit: Int = 50, offset: Int = 0): [Comment!]!
  }

  extend type Mutation {
    # Create post
    createPost(input: CreatePostInput!): Post!

    # Update post
    updatePost(id: ID!, input: UpdatePostInput!): Post!

    # Delete post
    deletePost(id: ID!): Boolean!

    # Like and unlike
    likePost(postId: ID!): Post!
    unlikePost(postId: ID!): Post!

    # Save and unsave
    savePost(postId: ID!): Boolean!
    unsavePost(postId: ID!): Boolean!

    # Block user
    blockUser(userId: ID!): Boolean!

    # Create a normal comment or reply
    createComment(postId: ID!, text: String!, parentCommentId: ID): Comment!

    # Edit your own comment
    updateComment(id: ID!, text: String!): Comment!

    # Delete your own comment and its nested replies
    deleteComment(id: ID!): Boolean!
  }
`;
