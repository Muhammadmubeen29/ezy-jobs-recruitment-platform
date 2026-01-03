// Vercel serverless function wrapper for Express app
const app = require('../app');
const mongoose = require('mongoose');

// Initialize database connection on cold start
let dbConnected = false;
let dbConnectionPromise = null;

const connectDBIfNeeded = async () => {
  // If already connected, return immediately
  if (dbConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // If connection is in progress, wait for it
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  // Start new connection
  dbConnectionPromise = (async () => {
    try {
      const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
      
      if (!mongoURI) {
        throw new Error('MongoDB URI not found in environment variables');
      }

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };

      // Add SSL options for production
      if (process.env.NODE_ENV === 'production') {
        options.ssl = true;
        options.sslValidate = false;
      }

      // Only connect if not already connected
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoURI, options);
        console.log('✅ MongoDB connected in serverless function');
      }
      
      dbConnected = true;
      dbConnectionPromise = null; // Reset promise after successful connection
    } catch (error) {
      dbConnectionPromise = null; // Reset promise on error
      console.error('❌ Database connection error in serverless function:', error.message);
      // Don't throw - let the request continue (some endpoints might work without DB)
      // The app's error handler will catch DB errors in route handlers
    }
  })();

  return dbConnectionPromise;
};

// Export serverless function handler
module.exports = async (req, res) => {
  // Connect to database on first request (cold start)
  // This is non-blocking - if connection fails, some routes might still work
  await connectDBIfNeeded().catch(err => {
    // Log but don't block the request
    console.error('Database connection attempt failed:', err.message);
  });
  
  // Handle the request with Express app
  return app(req, res);
};

