import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import {
  sharedTypes,
  userTypes,
  followTypes,
  postTypes,
  matchTypes,
  conversationTypes,
  messageTypes,
  notificationTypes,
} from "./graphql/typeDefs";
import { resolvers } from "./graphql/resolvers";
import { connectDB } from "./config/db";
import { createContext } from "./middleware/auth";

const typeDefs = [
  sharedTypes,
  userTypes,
  followTypes,
  postTypes,
  matchTypes,
  conversationTypes,
  messageTypes,
  notificationTypes,
];

async function startServer(): Promise<void> {
  const port = parseInt(process.env.PORT || "4000", 10);

  await connectDB(process.env.MONGODB_URI || "");

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const apolloServer = new ApolloServer({ schema });

  await apolloServer.start();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext({ req }),
    }),
  );

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.listen(port, () => {
    console.log(`Family Connect API ready at http://localhost:${port}/graphql`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
