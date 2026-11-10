import { verifyToken, JwtPayload } from '../utils/jwt';

export interface GraphQLContext {
  user?: JwtPayload;
  token?: string;
}

export const createContext = async ({ req }: { req: any }): Promise<GraphQLContext> => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return {};

  try {
    const user = verifyToken(token);
    return { user, token };
  } catch {
    // Invalid/expired token — treat as anonymous.
    return {};
  }
};

// Helper for resolvers that require an authenticated user.
export const requireUser = (context: GraphQLContext): JwtPayload => {
  if (!context.user) {
    throw new Error('Unauthorized: authentication required.');
  }
  return context.user;
};
