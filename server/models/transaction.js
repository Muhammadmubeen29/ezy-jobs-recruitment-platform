'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be greater than or equal to 0'],
    max: [999999.99, 'Amount cannot exceed $999,999.99'],
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
      message: 'Status must be one of: pending, completed, failed, cancelled, refunded',
    },
    default: 'pending',
  },
  transactionDate: {
    type: Date,
    required: [true, 'Transaction date is required'],
    default: Date.now,
  },
  transactionType: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: {
      values: ['payment', 'refund', 'payout', 'platform_fee'],
      message: 'Transaction type must be one of: payment, refund, payout, platform_fee',
    },
  },
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: [true, 'Contract ID is required'],
  },
  // Stripe-specific fields
  stripePaymentIntentId: {
    type: String,
    maxlength: [255, 'Stripe PaymentIntent ID must not exceed 255 characters'],
  },
  stripeTransferId: {
    type: String,
    maxlength: [255, 'Stripe Transfer ID must not exceed 255 characters'],
  },
  stripePayoutId: {
    type: String,
    maxlength: [255, 'Stripe Payout ID must not exceed 255 characters'],
  },
  platformFee: {
    type: Number,
    min: [0, 'Platform fee cannot be negative'],
    max: [99999.99, 'Platform fee cannot exceed $99,999.99'],
  },
  netAmount: {
    type: Number,
    min: [0, 'Net amount cannot be negative'],
    max: [999999.99, 'Net amount cannot exceed $999,999.99'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
transactionSchema.index({ contractId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ transactionDate: -1 });

// Static method to calculate platform fee
transactionSchema.statics.calculatePlatformFee = function(amount) {
  const PLATFORM_FEE_PERCENTAGE = 0.025; // 2.5%
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100; // Round to 2 decimal places
};

// Static method to calculate net amount
transactionSchema.statics.calculateNetAmount = function(amount) {
  const platformFee = this.calculatePlatformFee(amount);
  const netAmount = Math.round((amount - platformFee) * 100) / 100; // Round to 2 decimal places

  return {
    netAmount,
    platformFee,
  };
};

// Instance method to check if transaction is successful
transactionSchema.methods.isSuccessful = function() {
  return this.status === 'completed';
};

// Instance method to check if transaction failed
transactionSchema.methods.isFailed = function() {
  return ['failed', 'cancelled'].includes(this.status);
};

// Instance method to check if transaction is still pending
transactionSchema.methods.isPending = function() {
  return this.status === 'pending';
};

// Instance method to get transaction display name based on type
transactionSchema.methods.getDisplayType = function() {
  const typeMap = {
    payment: 'Contract Payment',
    refund: 'Payment Refund',
    payout: 'Interviewer Payout',
    platform_fee: 'Platform Fee',
  };

  return typeMap[this.transactionType] || this.transactionType;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
