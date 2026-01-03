const colors = require('colors');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const rateLimiter = require('express-rate-limit');
const helmet = require('helmet');
const http = require('http');
const morgan = require('morgan');
const path = require('path');
const { StatusCodes } = require('http-status-codes');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { Server } = require('socket.io');
const xss = require('xss-clean');

const connectDB = require('./config/database');
const db = require('./models');

const {
  errorHandler,
  notFoundHandler,
} = require('./middlewares/error.middleware');
const rawBodyMiddleware = require('./middlewares/webhook.middleware');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const resumeRoutes = require('./routes/resume.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const chatRoomRoutes = require('./routes/chatRoom.routes');
const contractRoutes = require('./routes/contract.routes');
const transactionRoutes = require('./routes/transaction.routes');
const interviewRoutes = require('./routes/interview.routes');
const interviewerRating = require('./routes/interviewerRating.routes');
const paymentRoutes = require('./routes/payment.routes');
const aiRoutes = require('./routes/ai.routes.js');
const reportRoutes = require('./routes/report.routes');
const preAssessmentRoutes = require('./routes/preAssessment.routes');

const setupChatSocket = require('./sockets/chat.socket');
const setupVideoCallSocket = require('./sockets/webrtc.socket');

const swaggerOptions = require('./docs/swaggerOptions');

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

const app = express();

app.set('trust proxy', 1);

app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res, next, options) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      });
    },
    standardHeaders: true,
    legacyHeaders: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(helmet());

// CORS configuration - supports both development and production
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()) || [
  'http://localhost:5173',
  'http://localhost:5000',
];

// Add CLIENT_URL to allowed origins if provided
if (process.env.CLIENT_URL && !corsOrigins.includes(process.env.CLIENT_URL)) {
  corsOrigins.push(process.env.CLIENT_URL);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (origin && corsOrigins.some(allowedOrigin => {
      // Exact match
      if (origin === allowedOrigin) return true;
      // Support Vercel preview URLs (e.g., https://project-git-branch.vercel.app)
      if (allowedOrigin.includes('vercel.app') && origin.includes('vercel.app')) {
        return true;
      }
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS. Origin: ${origin || 'none'}, Allowed: ${corsOrigins.join(', ')}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(xss());

app.use(cookieParser());

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
}

app.use(rawBodyMiddleware);

app.get('/', (req, res) => {
  res
    .status(StatusCodes.OK)
    .sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/v1/test', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'API health check successful. System is operational.',
    timestamp: new Date().toISOString(),
  });
});

if (NODE_ENV === 'development') {
  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/chat-rooms', chatRoomRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/interviewer-ratings', interviewerRating);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/pre-assessments', preAssessmentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Initialize server and Socket.io only if not in serverless mode
let server, io;

if (!isVercel) {
  server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupChatSocket(io);
  setupVideoCallSocket(io);
}

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Only start listening if not in serverless mode
    if (!isVercel && server) {
      server.listen(PORT, () => {
        console.log('\n' + '='.repeat(86).yellow);
        console.log(`🚀 SERVER STATUS`.bold.yellow);
        console.log('='.repeat(86).yellow);
        console.log(
          `✅ Status:     Server is running and listening for requests.`.green
        );
        console.log(`🔗 Port:       ${PORT}`.cyan);
        console.log(`🌍 Node ENV:   ${NODE_ENV}`.yellow);
        console.log(`⏰ Timestamp:  ${new Date().toLocaleString()}`.magenta);
        console.log('-'.repeat(86).yellow);
        console.log(`📍 Local URL:  ${SERVER_URL}`.cyan);
        console.log(`📘 API Docs:   ${SERVER_URL}/api-docs`.magenta);
        console.log('='.repeat(86).yellow);
      });
    } else if (isVercel) {
      // In serverless mode, just log that app is ready
      console.log('✅ Serverless function initialized');
    }
  } catch (error) {
    console.error('\n' + '='.repeat(86).red);
    console.error(`❌ SERVER STARTUP ERROR`.red.bold);
    console.error('='.repeat(86).red);
    console.error(`📌 Error Type: ${error.name || 'Unknown Error'}`.red);
    console.error(
      `💬 Message:    ${
        error.message || 'Server failed to start due to an unexpected error.'
      }`.red
    );
    console.error(`🕒 Time:       ${new Date().toLocaleString()}`.red);
    console.error('='.repeat(86).red);
    if (!isVercel) {
      process.exit(1);
    }
    throw error;
  }
};

// Only start server if not in serverless mode
// In serverless mode, Vercel will handle the request/response cycle
if (!isVercel) {
  startServer();
} else {
  // In serverless mode, connect to DB on first request (cold start)
  // This will be handled per-request in the serverless function
}

// Export app for serverless functions
module.exports = app;
