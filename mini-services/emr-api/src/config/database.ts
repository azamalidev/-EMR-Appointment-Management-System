
import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri =
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/emr_db';

  await mongoose.connect(uri);
  console.log('MongoDB connected successfully');
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}
