'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: [true, 'Chat room ID is required'],
  },
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
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required'],
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    minlength: [1, 'Message content must be at least 1 character'],
    maxlength: [5000, 'Message content must not exceed 5000 characters'],
  },
  isRead: {
    type: Boolean,
    default: false,
    required: [true, 'isRead status is required'],
  },
  messageType: {
    type: String,
    enum: {
      values: ['text', 'contract', 'system'],
      message: 'Message type must be one of the following: text, contract, system',
    },
    default: 'text',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
messageSchema.index({ chatRoomId: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
