'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name must not exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'First name must contain only letters and spaces'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name must not exceed 50 characters'],
    match: [/^[a-zA-Z\s]+$/, 'Last name must contain only letters and spaces'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    minlength: [10, 'Phone number must be at least 10 characters'],
    maxlength: [15, 'Phone number must not exceed 15 characters'],
    match: [/^\+(?:[0-9] ?){6,14}[0-9]$/, 'Please enter a valid phone number'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false, // Don't include password in queries by default
  },
  otp: {
    type: String,
    match: [/^\d{6}$/, 'OTP must be exactly 6 digits'],
  },
  otpExpires: {
    type: Date,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isLinkedinVerified: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isRecruiter: {
    type: Boolean,
    default: false,
  },
  isInterviewer: {
    type: Boolean,
    default: false,
  },
  isCandidate: {
    type: Boolean,
    default: true,
  },
  isTopRated: {
    type: Boolean,
    default: false,
  },
  // Stripe Connect Fields (for Interviewers)
  stripeAccountId: {
    type: String,
    maxlength: [255, 'Stripe account ID must not exceed 255 characters'],
  },
  // Stripe Customer ID (for Recruiters)
  stripeCustomerId: {
    type: String,
    maxlength: [255, 'Stripe customer ID must not exceed 255 characters'],
  },
  stripeAccountStatus: {
    type: String,
    enum: {
      values: ['pending', 'verified', 'restricted', 'rejected'],
      message: 'Invalid Stripe account status',
    },
  },
  payoutEnabled: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes are automatically created for unique fields (email, phone)
// No need for explicit index definitions as they're already created by unique: true

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual to link user's resume (one-to-one)
userSchema.virtual('resume', {
  ref: 'Resume',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.validatePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate access token
userSchema.methods.generateAccessToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
  });
};

// Instance method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  });
};

// Instance method to generate OTP
userSchema.methods.generateOTP = async function() {
  const OTP_LENGTH = 6;

  do {
    const otp = Array.from({ length: OTP_LENGTH }, () =>
      Math.floor(Math.random() * 10)
    ).join('');

    const existingUser = await this.constructor.findOne({ otp });

    if (!existingUser) {
      return otp;
    }
  } while (true);
};

// Instance method to check if user can receive payouts
userSchema.methods.canReceivePayouts = function() {
  return (
    this.isInterviewer &&
    this.stripeAccountId &&
    this.stripeAccountStatus === 'verified' &&
    this.payoutEnabled
  );
};

// Instance method to check if user can make payments
userSchema.methods.canMakePayments = function() {
  return this.isRecruiter;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
