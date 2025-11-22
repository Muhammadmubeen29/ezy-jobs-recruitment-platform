'use strict';

const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  agreedPrice: {
    type: Number,
    required: [true, 'Agreed price is required'],
    min: [1.0, 'Agreed price must be at least $1.00'],
    max: [100000.0, 'Agreed price cannot exceed $100,000.00'],
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'active', 'completed', 'cancelled'],
      message: 'Invalid status value',
    },
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded'],
      message: 'Invalid payment status value',
    },
    default: 'pending',
  },
  // Stripe Payment Fields
  paymentIntentId: {
    type: String,
    maxlength: [255, 'Payment Intent ID must not exceed 255 characters'],
  },
  stripeApplicationFee: {
    type: Number,
    min: [0, 'Stripe application fee cannot be negative'],
  },
  stripeTransferId: {
    type: String,
    maxlength: [255, 'Stripe Transfer ID must not exceed 255 characters'],
  },
  // Foreign Keys
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recruiter ID is required'],
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Interviewer ID is required'],
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: [true, 'Room ID is required'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
contractSchema.index({ recruiterId: 1 });
contractSchema.index({ interviewerId: 1 });
contractSchema.index({ jobId: 1 });
contractSchema.index({ roomId: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ paymentStatus: 1 });

// Virtual populate for interviewer ratings
contractSchema.virtual('interviewerRatings', {
  ref: 'InterviewerRating',
  localField: '_id',
  foreignField: 'contractId',
});

// Virtual populate for transactions
contractSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'contractId',
});

// Instance method to calculate platform fee
contractSchema.methods.calculatePlatformFee = function() {
  const PLATFORM_FEE_PERCENTAGE = 0.025; // 2.5%
  return Math.round(this.agreedPrice * PLATFORM_FEE_PERCENTAGE * 100) / 100;
};

// Instance method to calculate net amount
contractSchema.methods.calculateNetAmount = function() {
  const platformFee = this.calculatePlatformFee();
  return Math.round((this.agreedPrice - platformFee) * 100) / 100;
};

// Instance method to check if contract can be paid
contractSchema.methods.canBePaid = function() {
  return this.status === 'pending' && this.paymentStatus === 'pending';
};

// Instance method to check if contract can be completed
contractSchema.methods.canBeCompleted = function() {
  return this.status === 'active' && this.paymentStatus === 'paid';
};

// Instance method to check if contract is active
contractSchema.methods.isActive = function() {
  return this.status === 'active' && this.paymentStatus === 'paid';
};

// Instance method to check if contract is completed
contractSchema.methods.isCompleted = function() {
  return this.status === 'completed';
};

// Instance method to check if contract payment failed
contractSchema.methods.hasPaymentFailed = function() {
  return this.paymentStatus === 'failed';
};

// Instance method to get contract status display text
contractSchema.methods.getStatusDisplay = function() {
  const statusMap = {
    pending: 'Pending Payment',
    active: 'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return statusMap[this.status] || this.status;
};

// Instance method to get payment status display text
contractSchema.methods.getPaymentStatusDisplay = function() {
  const statusMap = {
    pending: 'Payment Pending',
    paid: 'Payment Completed',
    failed: 'Payment Failed',
    refunded: 'Payment Refunded',
  };

  return statusMap[this.paymentStatus] || this.paymentStatus;
};

// Instance method to calculate contract progress as percentage
contractSchema.methods.getProgressPercentage = function() {
  switch (this.status) {
    case 'pending':
      return this.paymentStatus === 'paid' ? 50 : 25;
    case 'active':
      return 75;
    case 'completed':
      return 100;
    case 'cancelled':
    default:
      return 0;
  }
};

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;
