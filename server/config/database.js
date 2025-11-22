require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
    
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    // Add SSL options for production
    if (process.env.NODE_ENV === 'production') {
      options.ssl = true;
      options.sslValidate = false;
    }

    const conn = await mongoose.connect(mongoURI, options);

    console.log('\n' + '='.repeat(86).blue);
    console.log(`🌐 DATABASE CONNECTION STATUS`.bold.blue);
    console.log('='.repeat(86).blue);
    console.log(`✅ Connection: MongoDB connection established!`.green);
    console.log(`🔗 Host:       ${conn.connection.host}`.cyan);
    console.log(`📦 Database:   ${conn.connection.name}`.cyan);
    console.log(`⏰ Timestamp:  ${new Date().toLocaleString()}`.magenta);
    console.log(`🌍 Node ENV:   ${process.env.NODE_ENV}`.yellow);
    console.log('='.repeat(86).blue);

    return conn;
  } catch (error) {
    console.error('\n' + '='.repeat(86).red);
    console.error(`❌ DATABASE CONNECTION ERROR`.red.bold);
    console.error('='.repeat(86).red);
    console.error(`📌 Error Type: ${error.name}`.red);
    console.error(`💬 Message: ${error.message}`.red);
    console.error('='.repeat(86).red);
    process.exit(1);
  }
};

module.exports = connectDB;
