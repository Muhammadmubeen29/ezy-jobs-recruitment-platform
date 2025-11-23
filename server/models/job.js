'use strict';

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    minlength: [2, 'Job title must be at least 2 characters'],
    maxlength: [100, 'Job title must not exceed 100 characters'],
    match: [/^[a-zA-Z0-9\s\-&(),.]+$/, 'Job title can only contain letters, numbers, spaces, and basic punctuation'],
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    minlength: [50, 'Job description must be at least 50 characters'],
    maxlength: [5000, 'Job description must not exceed 5000 characters'],
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters'],
    maxlength: [100, 'Company name must not exceed 100 characters'],
    match: [/^[a-zA-Z0-9\s\-&(),.]+$/, 'Company name can only contain letters, numbers, spaces, and basic punctuation'],
  },
  requirements: {
    type: [String],
    required: [true, 'Job requirements are required'],
    set: function(v) {
      // Accept array or newline/comma separated string and coerce to array
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string') {
        return v
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return v;
    },
    validate: {
      validator: function(value) {
        if (!Array.isArray(value)) return false;
        if (value.length < 1) return false;
        if (value.length > 20) return false;
        const joined = value.join('\n');
        return joined.length >= 50 && joined.length <= 2000;
      },
      message: 'Job requirements must be an array of 1-20 items and total length between 50 and 2000 characters',
    },
  },
  benefits: {
    type: [String],
    required: [true, 'Job benefits are required'],
    set: function(v) {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string') {
        return v
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return v;
    },
    validate: {
      validator: function(value) {
        if (!Array.isArray(value)) return false;
        if (value.length < 1) return false;
        if (value.length > 20) return false;
        const joined = value.join('\n');
        return joined.length >= 50 && joined.length <= 2000;
      },
      message: 'Job benefits must be an array of 1-20 items and total length between 50 and 2000 characters',
    },
  },
  salaryRange: {
    type: String,
    required: [true, 'Salary range is required'],
    trim: true,
    validate: {
      validator: function(value) {
        return /^\$\d+k?\s*-\s*\$\d+k?$/.test(value);
      },
      message: 'Salary range must be in format "$XXk - $XXXk"',
    },
  },
  category: {
    type: String,
    required: [true, 'Job category is required'],
    enum: {
      values: ['IT', 'Engineering', 'Sales', 'Marketing', 'Finance', 'Other'],
      message: 'Invalid job category',
    },
  },
  location: {
    type: String,
    required: [true, 'Job location is required'],
    trim: true,
    minlength: [2, 'Location must be at least 2 characters'],
    maxlength: [100, 'Location must not exceed 100 characters'],
    match: [/^[a-zA-Z0-9\s\-,]+$/, 'Location can only contain letters, numbers, spaces, hyphens, and commas'],
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recruiter ID is required'],
  },
  isClosed: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
jobSchema.index({ recruiterId: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ isClosed: 1 });
jobSchema.index({ createdAt: -1 });

// Virtual populate for applications
jobSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'jobId',
});

// Virtual populate for interviews
jobSchema.virtual('interviews', {
  ref: 'Interview',
  localField: '_id',
  foreignField: 'jobId',
});

// Virtual populate for chat rooms
jobSchema.virtual('chatRooms', {
  ref: 'ChatRoom',
  localField: '_id',
  foreignField: 'jobId',
});

// Virtual populate for contracts
jobSchema.virtual('contracts', {
  ref: 'Contract',
  localField: '_id',
  foreignField: 'jobId',
});

// Virtual populate for interviewer ratings
jobSchema.virtual('interviewerRatings', {
  ref: 'InterviewerRating',
  localField: '_id',
  foreignField: 'jobId',
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
