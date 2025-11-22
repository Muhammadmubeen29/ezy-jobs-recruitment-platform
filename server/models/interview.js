'use strict';

const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: [true, 'Room ID is required'],
    unique: true,
    trim: true,
  },
  scheduledTime: {
    type: Date,
    required: [true, 'Scheduled time is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Scheduled time must be in the future',
    },
  },
  callStartedAt: {
    type: Date,
    validate: {
      validator: function(value) {
        if (value && this.scheduledTime && value < this.scheduledTime) {
          return false;
        }
        return true;
      },
      message: 'Call start time cannot be before scheduled time',
    },
  },
  callEndedAt: {
    type: Date,
    validate: {
      validator: function(value) {
        if (value && this.callStartedAt && value <= this.callStartedAt) {
          return false;
        }
        return true;
      },
      message: 'Call end time must be after call start time',
    },
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Interviewer ID is required'],
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Candidate ID is required'],
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: [true, 'Application ID is required'],
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      message: 'Status must be one of: scheduled, ongoing, completed, cancelled',
    },
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [1000, 'Remarks must not exceed 1000 characters'],
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [2000, 'Summary must not exceed 2000 characters'],
  },
  rating: {
    type: Number,
    min: [0, 'Rating must be at least 0'],
    max: [5, 'Rating must not exceed 5'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
interviewSchema.index({ interviewerId: 1 });
interviewSchema.index({ candidateId: 1 });
interviewSchema.index({ jobId: 1 });
interviewSchema.index({ applicationId: 1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ scheduledTime: 1 });

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
