'use strict';

const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index for better query performance
chatRoomSchema.index({ recruiterId: 1 });
chatRoomSchema.index({ interviewerId: 1 });
chatRoomSchema.index({ jobId: 1 });

// Virtual populate for messages
chatRoomSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chatRoomId',
});

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;
