import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let connectionPromise = null;

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in environment variables');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2 && connectionPromise) {
    return connectionPromise;
  }

  mongoose.set('strictQuery', true);

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
    })
    .then((mongooseInstance) => {
      console.log('MongoDB connected');
      return mongooseInstance.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    connectionPromise = null;
    console.log('MongoDB disconnected');
  }
}

