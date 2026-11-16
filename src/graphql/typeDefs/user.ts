export const userTypes = /* GraphQL */ `
  type User {
    id: ID!
    fullName: String!
    username: String
    email: String!
    age: Int
    bio: String
    location: String
    profileImage: String

    # Profile verification badge
    isVerified: Boolean!

    # Email verification
    isEmailVerified: Boolean!

    interests: [String!]!
    isOnline: Boolean!
    lastSeen: DateTime

    privacy: PrivacySettings!
    appearance: AppearanceSettings!

    followersCount: Int!
    followingCount: Int!
    likesCount: Int!
    postsCount: Int!

    compatibility: CompatibilityInfo

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SignupOTPResponse {
    success: Boolean!
    message: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input UpdateProfileInput {
    fullName: String
    username: String
    age: Int
    bio: String
    location: String
    profileImage: String
    interests: [String!]
  }

  input UpdatePrivacyInput {
    profileVisibility: String
    showOnlineStatus: Boolean
    allowMessagesFrom: String
    showAge: Boolean
  }

  input UpdateAppearanceInput {
    theme: String
    accentColor: String
  }

  extend type Query {
    me: User!
    user(id: ID!): User

    users(limit: Int = 20, offset: Int = 0): [User!]!

    discoverNearby(limit: Int = 20, offset: Int = 0): [User!]!

    discoverNew(limit: Int = 20, offset: Int = 0): [User!]!

    discoverOnline(limit: Int = 20, offset: Int = 0): [User!]!

    discoverVerified(limit: Int = 20, offset: Int = 0): [User!]!
  }

  extend type Mutation {
    # Signup and email verification
    signup(
      fullName: String!
      email: String!
      password: String!
    ): SignupOTPResponse!

    verifySignupOTP(email: String!, otp: String!): AuthPayload!

    resendSignupOTP(email: String!): Boolean!

    # Login
    login(email: String!, password: String!): AuthPayload!

    # Profile
    updateProfile(input: UpdateProfileInput!): User!

    updateInterests(interests: [String!]!): User!

    updatePrivacy(input: UpdatePrivacyInput!): User!

    updateAppearance(input: UpdateAppearanceInput!): User!

    setOnlineStatus(isOnline: Boolean!): User!

    # Password reset
    requestPasswordResetOTP(email: String!): Boolean!

    verifyPasswordResetOTP(email: String!, otp: String!): String!

    resetPassword(resetToken: String!, newPassword: String!): Boolean!

    # User blocking
    blockUser(userId: ID!): Boolean!
  }
`;
