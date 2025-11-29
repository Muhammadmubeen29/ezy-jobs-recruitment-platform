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

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat rooms fetched successfully',
    count: chatRooms.length,
    chatRooms,
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

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat room details loaded successfully',
    chatRoom,
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

  const [interviewer, job] = await Promise.all([
    User.findById(chatRoom.interviewerId),
    Job.findById(chatRoom.jobId),
  ]);

  const recruiter = await User.findById(job.recruiterId);

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: interviewer.email,
      subject: 'EZY Jobs - Chat Room Deleted',
      html: generateEmailTemplate({
        firstName: interviewer.firstName,
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
              `Job Title: ${job.title}`,
              `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
              `Recruiter: ${recruiter.firstName} ${recruiter.lastName}`,
              `Created At: ${new Date(chatRoom.createdAt).toLocaleString()}`,
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
        firstName: recruiter.firstName,
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
              `Job Title: ${job.title}`,
              `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
              `Recruiter: ${recruiter.firstName} ${recruiter.lastName}`,
              `Created At: ${new Date(chatRoom.createdAt).toLocaleString()}`,
            ],
          },
        ],
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Chat room deleted but email could not be delivered.');
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

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Chat messages loaded successfully',
    count: messages.length,
    messages,
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
