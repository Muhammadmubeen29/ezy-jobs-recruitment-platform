'use strict';

const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    minlength: [2, 'Title must be at least 2 characters'],
    maxlength: [100, 'Title must not exceed 100 characters'],
  },
  summary: {
    type: String,
    trim: true,
    minlength: [50, 'Summary must be at least 50 characters'],
    maxlength: [500, 'Summary must not exceed 500 characters'],
  },
  headline: {
    type: String,
    trim: true,
    minlength: [10, 'Headline must be at least 10 characters'],
    maxlength: [150, 'Headline must not exceed 150 characters'],
  },
  skills: {
    type: [String],
    validate: {
      validator: function(value) {
        if (!Array.isArray(value)) {
          return false;
        }
        if (value.length < 1) {
          return false;
        }
        if (value.length > 20) {
          return false;
        }
        return true;
      },
      message: 'Skills must be an array with 1-20 items',
    },
  },
  experience: {
    type: String,
    trim: true,
    required: [true, 'Experience details are required'],
  },
  education: {
    type: String,
    trim: true,
    required: [true, 'Education details are required'],
  },
  industry: {
    type: String,
    trim: true,
    minlength: [2, 'Industry must be at least 2 characters'],
    maxlength: [50, 'Industry must not exceed 50 characters'],
  },
  availability: {
    type: String,
    enum: {
      values: ['Immediate', 'Two weeks', 'One month', 'More than a month'],
      message: 'Invalid availability status',
    },
  },
  company: {
    type: String,
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters'],
    maxlength: [100, 'Company name must not exceed 100 characters'],
  },
  achievements: {
    type: String,
    trim: true,
    maxlength: [1000, 'Achievements must not exceed 1000 characters'],
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
  },
  portfolio: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Portfolio must be a valid URL'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
// userId index is automatically created due to unique: true
resumeSchema.index({ skills: 1 });
resumeSchema.index({ industry: 1 });

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
