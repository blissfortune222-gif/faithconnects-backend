"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async (uri) => {
    if (!uri) {
        throw new Error('MONGODB_URI is not defined. Please set it in your .env file.');
    }
    mongoose_1.default.set('strictQuery', true);
    await mongoose_1.default.connect(uri);
    console.log('MongoDB connected');
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    await mongoose_1.default.disconnect();
    console.log('MongoDB disconnected');
};
exports.disconnectDB = disconnectDB;
//# sourceMappingURL=db.js.map