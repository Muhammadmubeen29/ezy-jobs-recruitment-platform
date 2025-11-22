'use strict';

const mongoose = require('mongoose');

const interviewerRatingSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
  },
  feedback: {
    type: String,
    required: [true, 'Feedback is required'],
    trim: true,
    minlength: [10, 'Feedback must be at least 10 characters'],
    maxlength: [1000, 'Feedback must not exceed 1000 characters'],
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Interviewer ID is required'],
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recruiter ID is required'],
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: [true, 'Contract ID is required'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
interviewerRatingSchema.index({ interviewerId: 1 });
interviewerRatingSchema.index({ recruiterId: 1 });
interviewerRatingSchema.index({ jobId: 1 });
interviewerRatingSchema.index({ contractId: 1 });
interviewerRatingSchema.index({ rating: 1 });

const InterviewerRating = mongoose.model('InterviewerRating', interviewerRatingSchema);

module.exports = InterviewerRating;
