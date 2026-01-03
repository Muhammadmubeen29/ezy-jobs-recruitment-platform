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
 * SIMPLIFIED: Now supports recruiters creating interviews
 *
 * @route POST /api/interviews
 * @access Private (Recruiter, Interviewer)
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */

const createInterview = asyncHandler(async (req, res) => {
  const user = req.user;
  // SIMPLIFIED: Support both new format (date + time) and legacy format (scheduledTime)
  const { 
    scheduledDate, 
    scheduledTimeString, 
    scheduledTime: legacyScheduledTime, // Legacy support
    candidateId, 
    jobId, 
    applicationId,
    interviewerId: providedInterviewerId,
    meetingType,
    notes
  } = req.body;

  // Determine interviewer and recruiter based on user role
  let interviewerId;
  let recruiterId;

  if (user.isRecruiter && !user.isAdmin) {
    // Recruiter creating interview - must provide interviewerId
    recruiterId = user.id;
    interviewerId = providedInterviewerId;

    if (!interviewerId) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Interviewer is required when creating an interview as a recruiter.');
    }
  } else if (user.isInterviewer && !user.isAdmin) {
    // Interviewer creating interview - use their own ID
    interviewerId = user.id;
  } else {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('Only recruiters or interviewers can create interviews.');
  }

  // Determine the scheduled datetime
  let scheduledDateTime;
  let scheduledDateObj;
  let scheduledTimeStr;

  // Support both new format (scheduledDate + scheduledTimeString) and legacy (scheduledTime)
  if (scheduledDate && scheduledTimeString) {
    // New simplified format
    scheduledDateObj = new Date(scheduledDate);
    scheduledTimeStr = scheduledTimeString;
    scheduledDateTime = new Date(`${scheduledDate}T${scheduledTimeString}`);
  } else if (legacyScheduledTime) {
    // Legacy format support
    scheduledDateTime = new Date(legacyScheduledTime);
    scheduledDateObj = scheduledDateTime;
    scheduledTimeStr = scheduledDateTime.toTimeString().slice(0, 5); // Extract HH:mm
  } else {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide either (scheduledDate + scheduledTimeString) or scheduledTime.');
  }

  // Validate required fields
  if (!candidateId || !jobId || !applicationId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide candidateId, jobId, and applicationId.');
  }

  if (isNaN(scheduledDateTime.getTime())) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Invalid date or time format.');
  }

  if (scheduledDateTime <= new Date()) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Interview must be scheduled for a future date and time.');
  }

  if (interviewerId === candidateId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('An interviewer cannot interview themselves.');
  }

  // Validate meeting type if provided
  const validMeetingTypes = ['Online', 'On-site', 'Phone'];
  const finalMeetingType = meetingType || 'Online';
  if (!validMeetingTypes.includes(finalMeetingType)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(`Meeting type must be one of: ${validMeetingTypes.join(', ')}`);
  }

  const job = await Job.findById(jobId).populate('recruiterId', 'firstName lastName email');

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The specified job position was not found.');
  }

  // If recruiter created this, verify they own the job
  if (user.isRecruiter && !user.isAdmin) {
    const jobRecruiterId = job.recruiterId?._id?.toString() || job.recruiterId?.toString();
    if (jobRecruiterId !== user.id.toString()) {
      res.status(StatusCodes.FORBIDDEN);
      throw new Error('You can only create interviews for your own job postings.');
    }
    recruiterId = user.id;
  } else {
    // Interviewer creating - get recruiter from job
    recruiterId = job.recruiterId?._id || job.recruiterId;
  }

  const [interviewer, candidate, recruiter, application] = await Promise.all([
    User.findById(interviewerId),
    User.findById(candidateId),
    User.findById(recruiterId),
    Application.findById(applicationId),
  ]);

  if (!interviewer || !interviewer.isInterviewer) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interviewer not found or is not a valid interviewer.');
  }

  if (!candidate || !candidate.isCandidate) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Candidate not found or is not a valid candidate.');
  }

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The specified job application was not found.');
  }

  // Verify application belongs to the candidate and job
  if (application.candidateId.toString() !== candidateId || application.jobId.toString() !== jobId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Application does not match the provided candidate or job.');
  }

  // Check for existing interviews at the same time (prevent double booking)
  const existingInterview = await Interview.findOne({
    status: { $in: ['scheduled', 'rescheduled'] },
    $or: [
      { interviewerId, scheduledDateTime: scheduledDateTime },
      { candidateId, scheduledDateTime: scheduledDateTime },
      {
        $and: [
          { $or: [{ interviewerId }, { candidateId }] },
          {
            $or: [
              { scheduledDateTime: scheduledDateTime },
              { scheduledTime: scheduledDateTime },
              {
                scheduledDateTime: {
                  $gte: new Date(scheduledDateTime.getTime() - 30 * 60000), // 30 minutes before
                  $lte: new Date(scheduledDateTime.getTime() + 30 * 60000), // 30 minutes after
                }
              },
              {
                scheduledTime: {
                  $gte: new Date(scheduledDateTime.getTime() - 30 * 60000),
                  $lte: new Date(scheduledDateTime.getTime() + 30 * 60000),
                }
              }
            ]
          }
        ]
      }
    ]
  });

  if (existingInterview) {
    res.status(StatusCodes.CONFLICT);
    throw new Error(
      'An interview is already scheduled at this time for one of the participants. Please choose a different time slot.'
    );
  }

  // Generate roomId only if meeting type is Online (for future WebRTC)
  const roomId = finalMeetingType === 'Online' ? generateRoomId() : undefined;

  const interview = await Interview.create({
    recruiterId,
    interviewerId,
    candidateId,
    jobId,
    applicationId,
    scheduledDate: scheduledDateObj,
    scheduledTimeString: scheduledTimeStr,
    scheduledDateTime,
    scheduledTime: scheduledDateTime, // Keep for backward compatibility
    meetingType: finalMeetingType,
    notes: notes || '',
    status: 'scheduled',
    roomId,
    remarks: `Interview scheduled for ${job.title} position`,
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
        `Date: ${scheduledDateObj.toLocaleDateString()}`,
        `Time: ${scheduledTimeStr}`,
        `Position: ${job.title}`,
        `Company: ${job.company}`,
        `Meeting Type: ${finalMeetingType}`,
        `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
        `Candidate: ${candidate.firstName} ${candidate.lastName}`,
        ...(roomId ? [`Room ID: ${roomId}`] : []),
        ...(notes ? [`Notes: ${notes}`] : []),
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

  // FIXED: Don't block interview creation if emails fail
  // Send email notifications - log errors but don't fail the request
  (async () => {
    try {
      await sendEmail(res, {
        from: process.env.NODEMAILER_SMTP_EMAIL,
        to: candidate.email,
        subject: 'EZY Jobs - Interview Scheduled',
        html: generateEmailTemplate({
          firstName: candidate.firstName,
          subject: 'Interview Scheduled',
          content: emailContent,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send email to candidate:', emailError.message);
    }

    try {
      await sendEmail(res, {
        from: process.env.NODEMAILER_SMTP_EMAIL,
        to: recruiter.email,
        subject: 'EZY Jobs - Interview Scheduled',
        html: generateEmailTemplate({
          firstName: recruiter.firstName,
          subject: 'Interview Scheduled',
          content: emailContent,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send email to recruiter:', emailError.message);
    }
  })();

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
  const user = req.user;
  let query = {};

  // Role-based data isolation
  if (user) {
    // Interviewers can ONLY see interviews assigned to them
    if (user.isInterviewer && !user.isAdmin) {
      query.interviewerId = user.id;
    }
    // Candidates can see their own interviews
    else if (user.isCandidate && !user.isInterviewer && !user.isRecruiter && !user.isAdmin) {
      query.candidateId = user.id;
    }
    // Recruiters can see interviews for their jobs
    else if (user.isRecruiter && !user.isAdmin) {
      query.recruiterId = user.id; // Simplified: use recruiterId field directly
      // Also include jobs they own for backward compatibility
      const recruiterJobs = await Job.find({ recruiterId: user.id }).select('_id');
      const recruiterJobIds = recruiterJobs.map(job => job._id.toString());
      if (recruiterJobIds.length > 0) {
        query.$or = [
          { recruiterId: user.id },
          { jobId: { $in: recruiterJobIds } }
        ];
      } else {
        query.recruiterId = user.id;
      }
    }
    // Admins can see all interviews (no filter)
  }

  if (status) {
    query.status = status;
  }

  if (scheduledTime) {
    const dateTime = new Date(scheduledTime);
    query.$or = [
      { scheduledDateTime: { $gte: dateTime } },
      { scheduledTime: { $gte: dateTime } }
    ];
  }

  // Override interviewerId filter if user is interviewer (already set above)
  // Only allow manual interviewerId filter for admins
  if (interviewerId && user?.isAdmin) {
    query.interviewerId = interviewerId;
  }

  // Allow candidateId filter for admins or if user is the candidate
  if (candidateId) {
    if (user?.isAdmin || (user?.isCandidate && candidateId === user.id.toString())) {
      query.candidateId = candidateId;
    }
  }

  // Allow jobId filter for admins or recruiters (if job belongs to them)
  if (jobId) {
    if (user?.isAdmin) {
      query.jobId = jobId;
    } else if (user?.isRecruiter && !user?.isAdmin) {
      // Verify the job belongs to the recruiter
      const job = await Job.findById(jobId);
      if (job && job.recruiterId.toString() === user.id.toString()) {
        query.jobId = jobId;
      } else {
        // Job doesn't belong to recruiter, return empty
        query.jobId = { $in: [] };
      }
    } else if (!query.jobId) {
      // For other roles, only if jobId wasn't already set by role-based filter
      query.jobId = jobId;
    }
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
  const user = req.user;

  // Verify job exists and check access
  const job = await Job.findById(jobId);
  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job not found.');
  }

  // Role-based access control
  if (user) {
    // Recruiters can only see interviews for their own jobs
    if (user.isRecruiter && !user.isAdmin) {
      if (job.recruiterId.toString() !== user.id.toString()) {
        res.status(StatusCodes.FORBIDDEN);
        throw new Error('You do not have permission to access interviews for this job.');
      }
    }
    // Interviewers can only see interviews assigned to them
    else if (user.isInterviewer && !user.isAdmin) {
      // Filter will be applied in the query below
    }
    // Candidates can see their own interviews
    else if (user.isCandidate && !user.isInterviewer && !user.isRecruiter && !user.isAdmin) {
      // Filter will be applied in the query below
    }
    // Admins can see all interviews (no restriction)
  }

  let query = { jobId };
  
  // Apply role-based filtering
  if (user) {
    if (user.isInterviewer && !user.isAdmin) {
      query.interviewerId = user.id;
    } else if (user.isCandidate && !user.isInterviewer && !user.isRecruiter && !user.isAdmin) {
      query.candidateId = user.id;
    }
  }

  const interviews = await Interview.find(query)
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
  const user = req.user;
  const interview = await Interview.findById(req.params.id)
    .populate('interviewerId', 'firstName lastName email')
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!interview) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interview not found.');
  }

  // Role-based access control
  if (user) {
    // Interviewers can ONLY see interviews assigned to them
    if (user.isInterviewer && !user.isAdmin) {
      if (interview.interviewerId._id.toString() !== user.id.toString()) {
        res.status(StatusCodes.FORBIDDEN);
        throw new Error('You do not have permission to access this interview.');
      }
    }
    // Candidates can see their own interviews
    else if (user.isCandidate && !user.isInterviewer && !user.isRecruiter && !user.isAdmin) {
      if (interview.candidateId._id.toString() !== user.id.toString()) {
        res.status(StatusCodes.FORBIDDEN);
        throw new Error('You do not have permission to access this interview.');
      }
    }
    // Recruiters can see interviews for their jobs
    else if (user.isRecruiter && !user.isAdmin) {
      const job = await Job.findById(interview.jobId._id || interview.jobId);
      if (!job || job.recruiterId.toString() !== user.id.toString()) {
        res.status(StatusCodes.FORBIDDEN);
        throw new Error('You do not have permission to access this interview.');
      }
    }
    // Admins can see all interviews (no restriction)
  } else {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('Authentication required to access interview details.');
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

  // SIMPLIFIED: Role-based access control - allow recruiters, interviewers, and admins
  const user = req.user;
  let hasPermission = false;

  if (user.isAdmin) {
    hasPermission = true;
  } else if (user.isRecruiter && !user.isAdmin) {
    // Recruiters can update interviews they created or for their jobs
    const recruiterId = interview.recruiterId?._id?.toString() || interview.recruiterId?.toString();
    const jobRecruiterId = interview.jobId?.recruiterId?._id?.toString() || interview.jobId?.recruiterId?.toString();
    if (recruiterId === user.id.toString() || jobRecruiterId === user.id.toString()) {
      hasPermission = true;
    }
  } else if (user.isInterviewer && !user.isAdmin) {
    // Interviewers can update interviews assigned to them
    const interviewerId = interview.interviewerId?._id?.toString() || interview.interviewerId?.toString();
    if (interviewerId === user.id.toString()) {
      hasPermission = true;
    }
  }

  if (!hasPermission) {
    res.status(StatusCodes.FORBIDDEN);
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

  // SIMPLIFIED: Role-based access control - allow recruiters, interviewers, and admins
  const user = req.user;
  let hasPermission = false;

  if (user.isAdmin) {
    hasPermission = true;
  } else if (user.isRecruiter && !user.isAdmin) {
    // Recruiters can cancel interviews they created or for their jobs
    const recruiterId = interview.recruiterId?._id?.toString() || interview.recruiterId?.toString();
    const job = await Job.findById(interview.jobId?._id || interview.jobId);
    const jobRecruiterId = job?.recruiterId?.toString();
    if (recruiterId === user.id.toString() || jobRecruiterId === user.id.toString()) {
      hasPermission = true;
    }
  } else if (user.isInterviewer && !user.isAdmin) {
    // Interviewers can cancel interviews assigned to them
    const interviewerId = interview.interviewerId?._id?.toString() || interview.interviewerId?.toString();
    if (interviewerId === user.id.toString()) {
      hasPermission = true;
    }
  }

  if (!hasPermission) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('You do not have permission to cancel this interview.');
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