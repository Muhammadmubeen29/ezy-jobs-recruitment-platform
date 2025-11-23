const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const { User, Job, Interview, Application } = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');
const { validateString } = require('../utils/validation.utils');
const { generateRoomId, generateRemarks } = require('../utils/interview.utils');

/**
 * @desc Create a new interview
 *
 * @route POST /api/interviews
 * @access Private (Interviewer)
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const createInterview = asyncHandler(async (req, res) => {
  const interviewerId = req.user.id;
  const { scheduledTime, candidateId, jobId, applicationId } = req.body;

  if (!scheduledTime || !candidateId || !jobId || !applicationId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please provide all required information to schedule the interview.'
    );
  }

  if (new Date(scheduledTime) <= new Date()) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Interview must be scheduled for a future date and time.');
  }

  if (interviewerId === candidateId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('An interviewer cannot interview themselves.');
  }

  const job = await Job.findById(jobId).populate('recruiterId', 'firstName lastName email');

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The specified job position was not found.');
  }

  const [interviewer, candidate, recruiter, application] = await Promise.all([
    User.findById(interviewerId),
    User.findById(candidateId),
    User.findById(job.recruiterId),
    Application.findById(applicationId),
  ]);

  if (!interviewer || !candidate) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Could not find the specified interviewer or candidate.');
  }

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The specified job application was not found.');
  }

  // Check for existing interviews at the same time
  const existingInterview = await Interview.findOne({
    $or: [
      { interviewerId, scheduledTime: new Date(scheduledTime) },
      { candidateId, scheduledTime: new Date(scheduledTime) },
      {
        $and: [
          { $or: [{ interviewerId }, { candidateId }] },
          {
            scheduledTime: {
              $gte: new Date(new Date(scheduledTime).getTime() - 30 * 60000),
              $lte: new Date(new Date(scheduledTime).getTime() + 30 * 60000),
            }
          }
        ]
      }
    ]
  });

  if (existingInterview) {
    res.status(StatusCodes.CONFLICT);
    throw new Error(
      'An interview is already scheduled at this time. Please choose a different time slot.'
    );
  }

  const roomId = generateRoomId();
  const remarks = generateRemarks();

  const interview = await Interview.create({
    interviewerId,
    candidateId,
    jobId,
    applicationId,
    scheduledTime: new Date(scheduledTime),
    status: 'scheduled',
    roomId,
    remarks,
  });

  if (!interview) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to create interview. Please try again.');
  }

  // Send email notifications
  const emailContent = [
    {
      type: 'heading',
      value: 'Interview Scheduled Successfully',
    },
    {
      type: 'text',
      value: `An interview has been scheduled for the position of <strong>${job.title}</strong> at ${job.company}.`,
    },
    {
      type: 'heading',
      value: 'Interview Details',
    },
    {
      type: 'list',
      value: [
        `Date & Time: ${new Date(scheduledTime).toLocaleString()}`,
        `Position: ${job.title}`,
        `Company: ${job.company}`,
        `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
        `Candidate: ${candidate.firstName} ${candidate.lastName}`,
        `Room ID: ${roomId}`,
      ],
    },
    {
      type: 'cta',
      value: {
        text: 'Join Interview',
        link: `${process.env.CLIENT_URL}/interview/${interview._id}`,
      },
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: candidate.email,
      subject: 'EZY Jobs - Interview Scheduled',
      html: generateEmailTemplate({
        firstName: candidate.firstName,
        subject: 'Interview Scheduled',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: recruiter.email,
      subject: 'EZY Jobs - Interview Scheduled',
      html: generateEmailTemplate({
        firstName: recruiter.firstName,
        subject: 'Interview Scheduled',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Interview created but notification emails could not be sent.'
    );
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Interview scheduled successfully.',
    interview,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get all interviews
 *
 * @route GET /api/interviews
 * @access Private
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getAllInterviews = asyncHandler(async (req, res) => {
  const { status, scheduledTime, interviewerId, candidateId, jobId } = req.query;
  let query = {};

  if (status) {
    query.status = status;
  }

  if (scheduledTime) {
    query.scheduledTime = { $gte: new Date(scheduledTime) };
  }

  if (interviewerId) {
    query.interviewerId = interviewerId;
  }

  if (candidateId) {
    query.candidateId = candidateId;
  }

  if (jobId) {
    query.jobId = jobId;
  }

  const interviews = await Interview.find(query)
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId')
    .sort({ scheduledTime: -1 });
  // Normalize returned interview objects to match client expectations
  const normalized = (interviews || []).map((iv) => {
    const obj = iv.toObject ? iv.toObject() : iv;
    return {
      ...obj,
      job: obj.jobId || { title: 'Not set', description: '' },
      candidate: obj.candidateId || { firstName: '', lastName: '', email: '' },
      interviewer: obj.interviewerId || { firstName: '', lastName: '', email: '' },
      application: obj.applicationId || null,
    };
  });

  if (!normalized || normalized.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No interviews found matching the criteria.',
      count: 0,
      interviews: [],
      timestamp: new Date().toISOString(),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Interviews retrieved successfully.',
    count: normalized.length,
    interviews: normalized,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get interviews by job ID
 *
 * @route GET /api/interviews/job/:jobId
 * @access Private
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getInterviewsByJobId = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const interviews = await Interview.find({ jobId })
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId')
    .sort({ scheduledTime: -1 });
  const normalized = (interviews || []).map((iv) => {
    const obj = iv.toObject ? iv.toObject() : iv;
    return {
      ...obj,
      job: obj.jobId || { title: 'Not set', description: '' },
      candidate: obj.candidateId || { firstName: '', lastName: '', email: '' },
      interviewer: obj.interviewerId || { firstName: '', lastName: '', email: '' },
      application: obj.applicationId || null,
    };
  });

  if (!normalized || normalized.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No interviews found for this job.',
      count: 0,
      interviews: [],
      timestamp: new Date().toISOString(),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Interviews retrieved successfully.',
    count: normalized.length,
    interviews: normalized,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get interview by ID
 *
 * @route GET /api/interviews/:id
 * @access Private
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getInterviewById = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!interview) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interview not found.');
  }

  const obj = interview.toObject ? interview.toObject() : interview;

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Interview details retrieved successfully.',
    interview: {
      ...obj,
      job: obj.jobId || null,
      candidate: obj.candidateId || null,
      interviewer: obj.interviewerId || null,
      application: obj.applicationId || null,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Update interview
 *
 * @route PUT /api/interviews/:id
 * @access Private (Interviewer, Admin)
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const updateInterview = asyncHandler(async (req, res) => {
  const { scheduledTime, status, rating, feedback } = req.body;

  const interview = await Interview.findById(req.params.id)
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!interview) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interview not found.');
  }

  // Check if user has permission to update
  if (req.user.isAdmin || interview.interviewerId._id.toString() === req.user.id) {
    // User has permission
  } else {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You do not have permission to update this interview.');
  }

  const updateData = {};

  if (scheduledTime) {
    if (new Date(scheduledTime) <= new Date()) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Interview must be scheduled for a future date and time.');
    }
    updateData.scheduledTime = new Date(scheduledTime);
  }

  if (status) {
    updateData.status = status;
  }

  if (rating !== undefined) {
    updateData.rating = rating;
  }

  if (feedback) {
    updateData.feedback = feedback;
  }

  const updatedInterview = await Interview.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  ).populate('interviewerId', 'firstName lastName email')
   .populate('candidateId', 'firstName lastName email')
   .populate('jobId', 'title company')
   .populate('applicationId');

  if (!updatedInterview) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to update interview. Please try again.');
  }

  // Send email notification if status changed
  if (status && status !== interview.status) {
    const emailContent = [
      {
        type: 'heading',
        value: 'Interview Status Updated',
      },
      {
        type: 'text',
        value: `The status of your interview for <strong>${interview.jobId.title}</strong> has been updated to <strong>${status}</strong>.`,
      },
      {
        type: 'heading',
        value: 'Interview Details',
      },
      {
        type: 'list',
        value: [
          `Date & Time: ${new Date(interview.scheduledTime).toLocaleString()}`,
          `Position: ${interview.jobId.title}`,
          `Company: ${interview.jobId.company}`,
          `Status: ${status}`,
        ],
      },
    ];

    await sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: interview.candidateId.email,
      subject: 'EZY Jobs - Interview Status Updated',
      html: generateEmailTemplate({
        firstName: interview.candidateId.firstName,
        subject: 'Interview Status Updated',
        content: emailContent,
      }),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Interview updated successfully.',
    interview: updatedInterview,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Delete interview
 *
 * @route DELETE /api/interviews/:id
 * @access Private (Interviewer, Admin)
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const deleteInterview = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!interview) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interview not found.');
  }

  // Check if user has permission to delete
  if (req.user.isAdmin || interview.interviewerId._id.toString() === req.user.id) {
    // User has permission
  } else {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You do not have permission to delete this interview.');
  }

  const deletedInterview = await Interview.findByIdAndDelete(req.params.id);

  if (!deletedInterview) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to delete interview. Please try again.');
  }

  // Send email notification
  const emailContent = [
    {
      type: 'heading',
      value: 'Interview Cancelled',
    },
    {
      type: 'text',
      value: `The interview for <strong>${interview.jobId.title}</strong> at ${interview.jobId.company} has been cancelled.`,
    },
    {
      type: 'heading',
      value: 'Interview Details',
      },
    {
      type: 'list',
      value: [
        `Date & Time: ${new Date(interview.scheduledTime).toLocaleString()}`,
        `Position: ${interview.jobId.title}`,
        `Company: ${interview.jobId.company}`,
      ],
    },
  ];

  await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: interview.candidateId.email,
    subject: 'EZY Jobs - Interview Cancelled',
    html: generateEmailTemplate({
      firstName: interview.candidateId.firstName,
      subject: 'Interview Cancelled',
      content: emailContent,
    }),
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Interview deleted successfully.',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createInterview,
  getAllInterviews,
  getInterviewById,
  getInterviewsByJobId,
  updateInterview,
  deleteInterview,
};