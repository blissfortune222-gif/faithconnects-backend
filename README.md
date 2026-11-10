# Family Connect — Backend

Production-ready GraphQL backend for the **Family Connect** social + dating/matching mobile app.

## Tech Stack

- Node.js + TypeScript
- GraphQL (Apollo Server v4)
- Express
- MongoDB + Mongoose
- JWT authentication (bcryptjs password hashing)
- CORS

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure MongoDB

You need a running MongoDB instance (local or a cloud provider such as MongoDB Atlas).
Grab the connection string, e.g. `mongodb+srv://<user>:<password>@<cluster>/family-connect`.

### 3. Create your environment file

Copy the example and fill in real values:

```bash
cp .env.example .env
```

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=replace-with-a-long-random-string
PORT=4000
```

Never commit `.env` — it is gitignored.

### 4. Run the development server

```bash
npm run dev
```

The GraphQL endpoint is available at:

```
http://localhost:4000/graphql
```

### 5. Build & run in production

```bash
npm run build
npm start
```

## Authentication Flow

1. **Signup** with `fullName`, `email`, `password` → returns a JWT + user.
2. **Login** with `email`, `password` → returns a JWT + user.
3. For every protected operation, send the JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

The server validates the JWT and injects `context.user` (with `id` and `email`)
into every resolver. Protected resolvers read the authenticated user from
`context.user` — the client never passes its own `userId` for actions performed
on its own behalf.

## Project Architecture

```
src/
  config/
    db.ts                 # MongoDB connection
  models/                 # Mongoose models (one collection per resource)
    User.ts
    Post.ts
    Follow.ts             # follower/following edges (separate collection)
    Like.ts               # post likes (separate collection)
    SavedPost.ts          # saved posts (separate collection)
    ProfileLike.ts        # dating like/pass decisions (separate collection)
    Match.ts              # matches between two users
    Conversation.ts
    Message.ts
    Notification.ts
  graphql/
    typeDefs/             # GraphQL schemas, one file per domain
      ...
    resolvers/            # GraphQL resolvers, one file per domain
      helpers.ts          # shared count/lookup utilities
      index.ts            # merges all resolvers
  middleware/
    auth.ts               # JWT context + requireUser helper
  utils/
    jwt.ts                # sign/verify JWT
    password.ts           # bcrypt hash/compare
    compatibility.ts      # compatibility scoring (isolated, replaceable)
  server.ts               # Express + Apollo bootstrap
```

Relationships and social data (followers, following, likes, saved posts,
profile likes, matches, messages, notifications) live in their own collections
rather than as large arrays inside the User document — this keeps the schema
scalable.

## Example Mutations & Queries

### Signup

```graphql
mutation {
  signup(fullName: "Jane Doe", email: "jane@example.com", password: "secret123") {
    token
    user { id fullName email }
  }
}
```

### Login

```graphql
mutation {
  login(email: "jane@example.com", password: "secret123") {
    token
    user { id fullName email }
  }
}
```

### Authenticated query (send the `Authorization: Bearer <token>` header)

```graphql
query {
  me {
    id
    fullName
    interests
    followersCount
    followingCount
  }
}
```

### Update interests

```graphql
mutation {
  updateInterests(interests: ["Music", "Travel", "Fitness"]) {
    id
    interests
  }
}
```

### Discover nearby users

```graphql
query {
  discoverNearby(limit: 20) {
    id
    fullName
    profileImage
    isVerified
    compatibility { score sharedInterests }
  }
}
```

### Follow a user

```graphql
mutation {
  followUser(userId: "<other-user-id>") {
    id
    followersCount
  }
}
```

### Like a profile (dating)

```graphql
mutation {
  likeProfile(userId: "<other-user-id>") {
    matched
    match { id conversationId }
  }
}
```

### Send a message

```graphql
mutation {
  sendMessage(conversationId: "<conversation-id>", text: "Hello!") {
    id
    text
    isRead
    createdAt
  }
}
```

## Security

- Passwords are hashed with bcryptjs and never returned by any GraphQL field.
- All mutating actions and private queries require a valid JWT.
- Authorization checks prevent editing/deleting other users' content, reading
  conversations you are not part of, accessing another user's saved posts, and
  following yourself.
- Duplicate prevention is enforced via unique compound indexes on Follow, Like,
  SavedPost, ProfileLike, and Match.
- The JWT secret is read from an environment variable and is never exposed.

## Environment Variables

| Variable      | Description                          |
| ------------- | ------------------------------------ |
| `MONGODB_URI` | MongoDB connection string            |
| `JWT_SECRET`  | Secret used to sign JWTs             |
| `PORT`        | Port the Express server listens on   |
