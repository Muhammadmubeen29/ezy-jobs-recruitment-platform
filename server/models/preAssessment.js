'use strict';

const mongoose = require('mongoose');

const preAssessmentSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: [true, 'Application ID is required'],
    unique: true,
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
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'expired'],
    default: 'pending',
  },
  questions: [
    {
      questionId: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ['mcq', 'coding'],
        required: true,
      },
      question: {
        type: String,
        required: true,
      },
      options: {
        type: [String],
        required: function() {
          return this.type === 'mcq';
        },
      },
      correctAnswer: {
        type: String,
        required: function() {
          return this.type === 'mcq';
        },
      },
      // For coding questions
      testCases: [
        {
          input: String,
          expectedOutput: String,
        },
      ],
      points: {
        type: Number,
        default: 10,
      },
    },
  ],
  answers: [
    {
      questionId: {
        type: String,
        required: true,
      },
      answer: {
        type: String,
        required: true,
      },
      submittedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  timeLimit: {
    type: Number, // in minutes
    default: 60,
  },
  startedAt: {
    type: Date,
  },
  submittedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  // Anti-cheating integrity data
  integrity: {
    faceDetectionViolations: [
      {
        type: {
          type: String,
          enum: ['no_face', 'multiple_faces'],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    tabSwitchTimestamps: [
      {
        type: Date,
      },
    ],
    plagiarismScores: [
      {
        questionId: String,
        similarityScore: Number, // 0-100
        checkedAt: Date,
      },
    ],
  },
  // Results
  score: {
    type: Number, // Total score out of total possible points
    default: 0,
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number, // Score percentage
    default: 0,
  },
  results: [
    {
      questionId: String,
      isCorrect: Boolean,
      pointsAwarded: Number,
      correctAnswer: String,
      candidateAnswer: String,
    },
  ],
  attemptCount: {
    type: Number,
    default: 0,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
preAssessmentSchema.index({ applicationId: 1 });
preAssessmentSchema.index({ candidateId: 1 });
preAssessmentSchema.index({ jobId: 1 });
preAssessmentSchema.index({ status: 1 });
preAssessmentSchema.index({ expiresAt: 1 });

// Compound index to ensure one active assessment per application
preAssessmentSchema.index({ applicationId: 1, status: 1 });

// Virtual to check if assessment is expired
preAssessmentSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual to check if assessment is active
preAssessmentSchema.virtual('isActive').get(function() {
  return this.status === 'in_progress' && !this.isExpired;
});

// Method to calculate score
preAssessmentSchema.methods.calculateScore = function() {
  if (!this.questions || !this.answers) {
    return { score: 0, totalPoints: 0, percentage: 0 };
  }

  let score = 0;
  let totalPoints = 0;
  const results = [];

  this.questions.forEach((question) => {
    totalPoints += question.points || 10;
    const answer = this.answers.find(
      (a) => a.questionId === question.questionId
    );

    if (question.type === 'mcq') {
      const isCorrect = answer && answer.answer === question.correctAnswer;
      const pointsAwarded = isCorrect ? (question.points || 10) : 0;
      score += pointsAwarded;

      results.push({
        questionId: question.questionId,
        isCorrect,
        pointsAwarded,
        correctAnswer: question.correctAnswer,
        candidateAnswer: answer ? answer.answer : '',
      });
    } else if (question.type === 'coding') {
      // For coding questions, we'll handle scoring separately during plagiarism check
      // For now, award full points if answer exists
      const pointsAwarded = answer ? (question.points || 10) : 0;
      score += pointsAwarded;

      results.push({
        questionId: question.questionId,
        isCorrect: !!answer,
        pointsAwarded,
        correctAnswer: 'N/A', // Coding questions don't have a single correct answer
        candidateAnswer: answer ? answer.answer : '',
      });
    }
  });

  const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;

  return { score, totalPoints, percentage, results };
};

const PreAssessment = mongoose.model('PreAssessment', preAssessmentSchema);

module.exports = PreAssessment;

