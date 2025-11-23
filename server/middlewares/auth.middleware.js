const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');

const { User } = require('../models');

const protectServer = asyncHandler(async (req, res, next) => {
  // Allow internal server-to-server authentication via a pre-shared internal token
  const internalToken = req.headers['x-internal-token'] || req.headers['x-internal-key'];
  if (internalToken && process.env.INTERNAL_API_KEY && internalToken === process.env.INTERNAL_API_KEY) {
    // Provide a minimal admin user context so role checks pass.
    req.user = {
      id: process.env.INTERNAL_SERVICE_USER_ID || 'internal-service',
      isAdmin: true,
      isRecruiter: false,
    };

    // Audit the internal-token usage (best-effort)
    try {
      const { AuditLog } = require('../models');
      // Create an audit entry asynchronously but await to ensure persistence
      AuditLog.create({
        action: 'internal_token_auth',
        actorId: req.user.id,
        actorType: 'internal-service',
        route: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
        details: {
          note: 'Authenticated via INTERNAL_API_KEY header',
        },
      }).catch((err) => {
        // Do not block the request on audit failures; just log the error
        console.warn('AuditLog create failed for internal-token auth:', err && err.message);
      });
    } catch (err) {
      console.warn('AuditLog not available to record internal-token usage:', err && err.message);
    }

    return next();
  }

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      const err = new Error('Authentication token is missing. Please log in again.');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
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
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      const err =
        jwtError.name === 'TokenExpiredError'
          ? new Error('Session expired. Please sign in again.')
          : jwtError.name === 'JsonWebTokenError'
          ? new Error('Invalid token. Please sign in again.')
          : new Error('Authentication failed. Please sign in again.');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
    }
  } else {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('Authentication token is missing. Please log in again.');
  }
});

const protectSocket = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    const err = new Error('Authentication token is missing. Please log in again.');
    err.statusCode = StatusCodes.UNAUTHORIZED;
    return next(err);
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
  } catch (jwtError) {
    console.error('Socket JWT verification error:', jwtError.message);
    const err =
      jwtError.name === 'TokenExpiredError'
        ? new Error('Session expired. Please sign in again.')
        : jwtError.name === 'JsonWebTokenError'
        ? new Error('Invalid token. Please sign in again.')
        : new Error('Authentication failed. Please sign in again.');
    err.statusCode = StatusCodes.UNAUTHORIZED;
    return next(err);
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
