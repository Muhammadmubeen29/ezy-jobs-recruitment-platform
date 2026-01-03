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

const app = express();
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Middleware
app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(xss());
app.use(cookieParser());

const corsOrigins =
  process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [
    'http://localhost:5173',
    'http://localhost:5000',
  ];
if (process.env.CLIENT_URL && !corsOrigins.includes(process.env.CLIENT_URL)) {
  corsOrigins.push(process.env.CLIENT_URL);
}
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin && NODE_ENV === 'development') return callback(null, true);
    if (origin && corsOrigins.some(allowed => origin.includes(allowed))) return callback(null, true);
    callback(new Error(`Not allowed by CORS: ${origin || 'none'}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));

if (NODE_ENV === 'development') app.use(morgan('dev'));
if (NODE_ENV === 'production') app.use(morgan('combined'));

app.use(rawBodyMiddleware);

// Routes
app.get('/', (req, res) => {
  // Safe for serverless Vercel: just return JSON
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/test', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'API health check successful. System is operational.',
    timestamp: new Date().toISOString(),
  });
});

// Swagger only in local dev
if (NODE_ENV === 'development' && !isVercel) {
  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
}

// API routes
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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Local server with Socket.io (not in Vercel)
if (!isVercel) {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  setupChatSocket(io);
  setupVideoCallSocket(io);

  connectDB().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = app;
