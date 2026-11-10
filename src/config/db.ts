import mongoose from "mongoose";

export const connectDB = async (uri: string): Promise<void> => {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not defined. Please set it in your .env file.",
    );
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("MongoDB connected");
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log("MongoDB disconnected");
};
