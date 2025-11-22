'use strict';

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['applied', 'shortlisted', 'rejected', 'hired'],
      message: 'Invalid application status',
    },
    default: 'applied',
  },
  applicationDate: {
    type: Date,
    required: [true, 'Application date is required'],
    default: Date.now,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Candidate ID is required'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ candidateId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ applicationDate: -1 });

// Compound index to prevent duplicate applications
applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
