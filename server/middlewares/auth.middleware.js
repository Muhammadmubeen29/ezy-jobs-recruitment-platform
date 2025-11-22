const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');

const { User } = require('../models');

const protectServer = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(StatusCodes.UNAUTHORIZED);
      throw new Error('Authentication token is missing. Please log in again.');
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_TOKEN_SECRET || 'your-secret-key'
      );

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(StatusCodes.UNAUTHORIZED);
        throw new Error(
          'User account not found. Please log in with a valid account.'
        );
      }

      next();
    } catch (error) {
      console.error('JWT verification error:', error.message);
      res.status(StatusCodes.UNAUTHORIZED);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Session expired. Please sign in again.');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token. Please sign in again.');
      } else {
        throw new Error('Authentication failed. Please sign in again.');
      }
    }
  } else {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('Authentication token is missing. Please log in again.');
  }
});

const protectSocket = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(
      new Error('Authentication token is missing. Please log in again.')
    );
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_SECRET || 'your-secret-key'
    );

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(
        new Error('User account not found. Please log in with a valid account.')
      );
    }

    socket.user = user.toJSON();

    next();
  } catch (error) {
    console.error('Socket JWT verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Session expired. Please sign in again.'));
    } else if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token. Please sign in again.'));
    } else {
      return next(new Error('Authentication failed. Please sign in again.'));
    }
  }
};

const authorizeServerRoles = (...flags) => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    const hasRequiredFlag = flags.some((flag) => user[flag] === true);

    if (hasRequiredFlag) {
      next();
    } else {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You do not have permission to access this resource.',
        timestamp: new Date().toISOString(),
      });
    }
  });
};

const authorizeSocketRoles = (...flags) => {
  return (socket, next) => {
    const user = socket.user;
    const hasRequiredFlag = flags.some((flag) => user[flag] === true);

    if (hasRequiredFlag) {
      next();
    } else {
      return next(
        new Error('You do not have permission to access this resource.')
      );
    }
  };
};

module.exports = {
  protectServer,
  protectSocket,
  authorizeServerRoles,
  authorizeSocketRoles,
};
