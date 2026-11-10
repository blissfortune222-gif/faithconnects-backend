"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = exports.createContext = void 0;
const jwt_1 = require("../utils/jwt");
const createContext = async ({ req }) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token)
        return {};
    try {
        const user = (0, jwt_1.verifyToken)(token);
        return { user, token };
    }
    catch {
        // Invalid/expired token — treat as anonymous.
        return {};
    }
};
exports.createContext = createContext;
// Helper for resolvers that require an authenticated user.
const requireUser = (context) => {
    if (!context.user) {
        throw new Error('Unauthorized: authentication required.');
    }
    return context.user;
};
exports.requireUser = requireUser;
//# sourceMappingURL=auth.js.map