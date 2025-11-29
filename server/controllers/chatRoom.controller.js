const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const { ChatRoom, Job, Message, User } = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');
const { validateString } = require('../utils/validation.utils');

/**
 * @desc Creates a Chat Room
 *
 * @route POST /api/v1/chat-rooms
 * @access Private (Recruiters, Interviewers)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const createChatRoom = asyncHandler(async (req, res) => {
  const { interviewerId, jobId } = req.body;

  if (!interviewerId || !jobId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please provide both an interviewer and job to create a chat room.'
    );
  }

  const job = await Job.findById(jobId);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job not found. Please check and try again.');
  }

  const interviewer = await User.findById(interviewerId);

  if (!interviewer) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interviewer not found. Please check and try again.');
  }

  const chatRoom = await ChatRoom.create({
    jobId,
    interviewerId,
    recruiterId: job.recruiterId,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Chat room created successfully',
    chatRoom,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get all Chat Rooms
 *
 * @route GET /api/v1/chat-rooms
 * @access Private (Recruiters, Interviewers, Admins)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 *
 */

const getAllChatRooms = asyncHandler(async (req, res) => {
  const { role, jobId: qJobId, interviewerId: qInterviewerId, recruiterId: qRecruiterId } = req.query;
  const whereClause = {};

  if (role) {
    switch (role) {
      case 'recruiter':
        whereClause.recruiterId = req.user.id;
        break;
      case 'interviewer':
        whereClause.interviewerId = req.user.id;
        break;
      default:
        break;
    }
  }

  if (qJobId) whereClause.jobId = qJobId;
  if (qInterviewerId) whereClause.interviewerId = qInterviewerId;
  if (qRecruiterId) whereClause.recruiterId = qRecruiterId;

  const chatRoomsQuery = ChatRoom.find(whereClause)
    .populate('jobId', 'title location salaryRange')
    .populate('interviewerId', 'id firstName lastName email')
    .populate('recruiterId', 'id firstName lastName email')
    .sort({ createdAt: -1 });

  const chatRooms = await chatRoomsQuery.exec();

  if (!chatRooms || chatRooms.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No chat rooms available matching the criteria',
      count: 0,
      chatRooms: [],
      timestamp: new Date().toISOString(),
    });
  }

  // FIXED: Normalize chat room data to ensure all populated fields exist
  // CRASH CAUSE: Populated fields (jobId, interviewerId, recruiterId) might be null/undefined
  // SOLUTION: Transform data to ensure safe structure before sending to frontend
  const normalizedChatRooms = chatRooms.map((room) => {
    const roomObj = room.toObject ? room.toObject() : room;
    return {
      ...roomObj,
      id: roomObj._id || roomObj.id,
      job: roomObj.jobId || { title: 'Job Not Found', location: 'N/A', salaryRange: 'N/A' },
      interviewer: roomObj.interviewerId || { 
        id: 'unknown', 
        firstName: 'Unknown', 
        lastName: '', 
        email: 'N/A' 
      },
      recruiter: roomObj.recruiterId || { 
        id: 'unknown', 
        firstName: 'Unknown', 
        lastName: '', 
        email: 'N/A' 
      },
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat rooms fetched successfully',
    count: normalizedChatRooms.length,
    chatRooms: normalizedChatRooms,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get a Chat Room by ID
 *
 * @route GET /api/v1/chat-rooms/:id
 * @access Private (Recruiters, Interviewers, Admins)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 *
 */

const getChatRoomById = asyncHandler(async (req, res) => {
  const chatRoomId = req.params.id;

  if (!validateString(res, chatRoomId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Invalid chat room ID provided. Please try again.');
  }

  const chatRoom = await ChatRoom.findById(chatRoomId)
    .populate('jobId', 'title location salaryRange')
    .populate('interviewerId', 'id firstName lastName email')
    .populate('recruiterId', 'id firstName lastName email');

  if (!chatRoom) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Chat room not found. Please check the ID and try again.');
  }

  // FIXED: Normalize chat room data to ensure safe structure
  // CRASH CAUSE: Populated fields might be null/undefined
  // SOLUTION: Transform to ensure all fields exist with defaults
  const roomObj = chatRoom.toObject ? chatRoom.toObject() : chatRoom;
  const normalizedChatRoom = {
    ...roomObj,
    id: roomObj._id || roomObj.id,
    job: roomObj.jobId || { title: 'Job Not Found', location: 'N/A', salaryRange: 'N/A' },
    interviewer: roomObj.interviewerId || { 
      id: 'unknown', 
      firstName: 'Unknown', 
      lastName: '', 
      email: 'N/A' 
    },
    recruiter: roomObj.recruiterId || { 
      id: 'unknown', 
      firstName: 'Unknown', 
      lastName: '', 
      email: 'N/A' 
    },
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat room details loaded successfully',
    chatRoom: normalizedChatRoom,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Delete a Chat Room by ID
 *
 * @route DELETE /api/v1/chat-rooms/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 *
 */

const deleteChatRoom = asyncHandler(async (req, res) => {
  const chatRoom = await ChatRoom.findById(req.params.id);

  if (!chatRoom) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Chat room not found. Please check and try again later.');
  }

  const deletedChatRoom = await ChatRoom.findByIdAndDelete(req.params.id);

  if (!deletedChatRoom) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Chat room could not be deleted. Please try again later.');
  }

  // FIXED: Added guards to prevent crashes when references are missing
  // CRASH CAUSE: chatRoom.interviewerId or chatRoom.jobId might be null/undefined
  // SOLUTION: Check references exist before querying, provide safe defaults
  const [interviewer, job] = await Promise.all([
    chatRoom.interviewerId ? User.findById(chatRoom.interviewerId) : null,
    chatRoom.jobId ? Job.findById(chatRoom.jobId) : null,
  ]);

  if (!interviewer || !job) {
    // If required data is missing, skip email but still delete
    console.warn('ChatRoom deleted but some referenced data is missing - skipping email notifications');
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Chat room has been successfully deleted',
      timestamp: new Date().toISOString(),
    });
  }

  const recruiter = await User.findById(job.recruiterId);

  if (!recruiter) {
    console.warn('ChatRoom deleted but recruiter not found - skipping email notifications');
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Chat room has been successfully deleted',
      timestamp: new Date().toISOString(),
    });
  }

  // FIXED: Added guards for email sending with safe access
  // CRASH CAUSE: interviewer/recruiter might not have email/firstName
  // SOLUTION: Only send emails if all required fields exist
  if (!interviewer.email || !recruiter.email) {
    console.warn('ChatRoom deleted but email addresses missing - skipping email notifications');
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Chat room has been successfully deleted',
      timestamp: new Date().toISOString(),
    });
  }

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: interviewer.email,
      subject: 'EZY Jobs - Chat Room Deleted',
      html: generateEmailTemplate({
        firstName: interviewer.firstName || 'User',
        subject: 'Chat Room Deleted',
        content: [
          {
            type: 'text',
            value: `This chat room has been permanently removed from the system.`,
          },
          { type: 'heading', value: 'Chat Room Details' },
          {
            type: 'list',
            value: [
              `Job Title: ${job?.title || 'N/A'}`,
              `Interviewer: ${interviewer?.firstName || 'Unknown'} ${interviewer?.lastName || ''}`,
              `Recruiter: ${recruiter?.firstName || 'Unknown'} ${recruiter?.lastName || ''}`,
              `Created At: ${chatRoom.createdAt ? new Date(chatRoom.createdAt).toLocaleString() : 'N/A'}`,
            ],
          },
        ],
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: recruiter.email,
      subject: 'EZY Jobs - Chat Room Deleted',
      html: generateEmailTemplate({
        firstName: recruiter.firstName || 'User',
        subject: 'Chat Room Deleted',
        content: [
          {
            type: 'text',
            value: `This chat room has been permanently removed from the system.`,
          },
          { type: 'heading', value: 'Chat Room Details' },
          {
            type: 'list',
            value: [
              `Job Title: ${job?.title || 'N/A'}`,
              `Interviewer: ${interviewer?.firstName || 'Unknown'} ${interviewer?.lastName || ''}`,
              `Recruiter: ${recruiter?.firstName || 'Unknown'} ${recruiter?.lastName || ''}`,
              `Created At: ${chatRoom.createdAt ? new Date(chatRoom.createdAt).toLocaleString() : 'N/A'}`,
            ],
          },
        ],
      }),
    }),
  ]);

  // FIXED: Only warn about email failure, don't fail the entire request
  // CRASH CAUSE: Email failure should not break the chat room deletion operation
  // SOLUTION: Log warning but continue with successful response
  if (!isEmailSent || (Array.isArray(isEmailSent) && isEmailSent.some(result => !result))) {
    console.warn('Chat room deleted successfully but email notifications could not be delivered.');
    // Don't throw error - chat room deletion was successful
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat room has been successfully deleted',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc    Create a new message
 * @route   POST /api/v1/chat-rooms/:id/messages
 * @access  Private (Recruiters, Interviewers)
 */
const createMessage = asyncHandler(async (req, res) => {
  const chatRoomId = req.params.id;
  const { content } = req.body;

  const senderId = req.user.id;

  if (!chatRoomId || !content) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide both a chat room ID and message content');
  }

  const chatRoom = await ChatRoom.findById(chatRoomId);

  if (!chatRoom) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Chat room not found. Please check and try again.');
  }

  // Ensure user is part of this chat
  if (senderId !== chatRoom.recruiterId.toString() && senderId !== chatRoom.interviewerId.toString()) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('You are not authorized to send messages in this chat room');
  }

  const message = await Message.create({
    chatRoomId,
    senderId,
    content,
    recruiterId: chatRoom.recruiterId,
    interviewerId: chatRoom.interviewerId,
    isRead: false,
  });

  const messageWithUser = await Message.findById(message._id)
    .populate('recruiterId', 'id firstName lastName email')
    .populate('interviewerId', 'id firstName lastName email');

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Message sent successfully',
    data: messageWithUser,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get all Messages from a Chat Room
 *
 * @route GET /api/v1/chat-rooms/:id/messages
 * @access Private (Recruiters, Interviewers)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getAllMessagesFromChatRoom = asyncHandler(async (req, res) => {
  const chatRoomId = req.params.id;

  if (!validateString(res, chatRoomId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide a valid chat room ID to load messages.');
  }

  const chatRoom = await ChatRoom.findById(chatRoomId);

  if (!chatRoom) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Chat room not found. Please check and try again.');
  }

  const messages = await Message.find({ chatRoomId })
    .populate('recruiterId', 'id firstName lastName email')
    .populate('interviewerId', 'id firstName lastName email')
    .populate('chatRoomId', 'id')
    .sort({ createdAt: 1 });

  if (!messages || messages.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No messages available in this chat room yet.',
      count: 0,
      messages: [],
      timestamp: new Date().toISOString(),
    });
  }

  // FIXED: Normalize messages to ensure safe structure
  // CRASH CAUSE: Populated sender/receiver fields might be null/undefined
  // SOLUTION: Transform messages to ensure all required fields exist
  const normalizedMessages = messages.map((msg) => {
    const msgObj = msg.toObject ? msg.toObject() : msg;
    return {
      ...msgObj,
      id: msgObj._id || msgObj.id,
      senderId: msgObj.senderId?._id || msgObj.senderId || msgObj.recruiterId?._id || msgObj.interviewerId?._id,
      sender: msgObj.senderId || msgObj.recruiterId || msgObj.interviewerId || {
        id: 'unknown',
        firstName: 'Unknown',
        lastName: '',
        email: 'N/A'
      },
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat messages loaded successfully',
    count: normalizedMessages.length,
    messages: normalizedMessages,
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createChatRoom,
  getAllChatRooms,
  getChatRoomById,
  deleteChatRoom,
  createMessage,
  getAllMessagesFromChatRoom,
};
