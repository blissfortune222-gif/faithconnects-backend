"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const schema_1 = require("@graphql-tools/schema");
const typeDefs_1 = require("./graphql/typeDefs");
const resolvers_1 = require("./graphql/resolvers");
const db_1 = require("./config/db");
const auth_1 = require("./middleware/auth");
const typeDefs = [
  typeDefs_1.sharedTypes,
  typeDefs_1.userTypes,
  typeDefs_1.followTypes,
  typeDefs_1.postTypes,
  typeDefs_1.matchTypes,
  typeDefs_1.conversationTypes,
  typeDefs_1.messageTypes,
  typeDefs_1.notificationTypes,
];
async function startServer() {
  const port = parseInt(process.env.PORT || "4000", 10);
  await (0, db_1.connectDB)(process.env.MONGODB_URI || "");
  const schema = (0, schema_1.makeExecutableSchema)({
    typeDefs,
    resolvers: resolvers_1.resolvers,
  });
  const apolloServer = new server_1.ApolloServer({ schema });
  await apolloServer.start();
  const app = (0, express_1.default)();
  app.use((0, cors_1.default)());
  app.use(express_1.default.json());
  app.use(
    "/graphql",
    (0, express4_1.expressMiddleware)(apolloServer, {
      context: async ({ req }) => (0, auth_1.createContext)({ req }),
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
//# sourceMappingURL=server.js.map
