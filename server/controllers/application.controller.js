const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const { Application, Contract, Job, User } = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');

// Helper to normalize application objects for API responses so front-end
// can use `application.job` and `application.candidate` instead of `jobId`/`candidateId`.
const formatApplicationForResponse = (application) => {
  if (!application) return application;

  const appObj = application.toObject ? application.toObject() : { ...application };

  // prefer populated fields if available
  const job = appObj.job || appObj.jobId || null;
  const candidate = appObj.candidate || appObj.candidateId || null;

  // remove old keys to avoid duplication
  delete appObj.jobId;
  delete appObj.candidateId;

  return {
    ...appObj,
    job,
    candidate,
  };
};

/**
 * @desc Creates a new application
 *
 * @route POST /api/v1/applications
 * @access Private (Candidate)
 *
 * @param {Object} req - The request object containing the job ID.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const createApplication = asyncHandler(async (req, res) => {
  const { jobId } = req.body;
  const candidateId = req.user.id;

  const [candidate, job] = await Promise.all([
    User.findById(candidateId),
    Job.findById(jobId).populate('recruiterId'),
  ]);

  if (!candidate) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Unable to locate your candidate profile. Please try again.'
    );
  }

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'The job posting you are trying to apply for no longer exists.'
    );
  }

  const existingApplication = await Application.findOne({
    jobId,
    candidateId,
  });

  if (existingApplication) {
    res.status(StatusCodes.CONFLICT);
    throw new Error(
      'You have already submitted an application for this position.'
    );
  }

  const application = await Application.create({
    jobId,
    candidateId,
    status: 'applied',
    applicationDate: new Date(),
  });

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: job.recruiterId.email,
    subject: 'EZY Jobs - New Application Received',
    html: generateEmailTemplate({
      firstName: job.recruiterId.firstName,
      subject: 'EZY Jobs - New Application Received',
      content: [
        {
          type: 'heading',
          value: 'New Application Received!',
        },
        {
          type: 'text',
          value: `A new application has been received for the position of <strong>${job.title}</strong> at ${job.company}.`,
        },
        {
          type: 'heading',
          value: 'Application Details',
        },
        {
          type: 'list',
          value: [
            `Candidate: ${candidate.firstName} ${candidate.lastName}`,
            `Email: ${candidate.email}`,
            `Application Date: ${new Date(
              application.applicationDate
            ).toLocaleDateString()}`,
            `Status: ${application.status.charAt(0).toUpperCase() +
            application.status.slice(1)
            }`,
          ],
        },
        {
          type: 'cta',
          value: {
            text: 'Review Application',
            link: `${process.env.CLIENT_URL}/applications/${application._id}`,
          },
        },
        {
          type: 'text',
          value:
            'If you have any questions or need assistance, our support team is always ready to help.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Application submitted successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Your application has been successfully submitted.',
    application: formatApplicationForResponse(application),
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get all applications
 *
 * @route GET /api/v1/applications
 * @access Private
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getAllApplications = asyncHandler(async (req, res) => {
  const { role, status, applicationDate, jobId, candidateId, interviewerId } =
    req.query;
  let query = {};

  if (role) {
    switch (role) {
      case 'candidate':
        query.candidateId = req.user.id;
        break;
      case 'interviewer':
        query.status = { $in: ['shortlisted'] };
        break;
      case 'recruiter':
        // For recruiter, we need to find applications for jobs they posted
        const recruiterJobs = await Job.find({ recruiterId: req.user.id }).select('_id');
        const recruiterJobIds = recruiterJobs.map(job => job._id);
        query.jobId = { $in: recruiterJobIds };
        break;
    }
  }

  if (status) {
    query.status = status;
  }

  if (applicationDate) {
    query.applicationDate = {
      $gte: new Date(applicationDate),
    };
  }

  if (jobId) {
    query.jobId = jobId;
  }

  if (candidateId) {
    query.candidateId = candidateId;
  }

  if (interviewerId) {
    const contracts = await Contract.find({
      interviewerId: interviewerId,
    }).select('jobId');

    const jobIds = contracts.map((contract) => contract.jobId);

    if (jobIds.length > 0) {
      query.jobId = { $in: jobIds };
    } else {
      query.jobId = { $in: [] };
    }
  }

  const applications = await Application.find(query)
    .populate('jobId', 'title company category location')
    .populate('candidateId', 'firstName lastName email')
    .sort({ applicationDate: -1 });

  if (!applications || applications.length === 0) {
    // Return empty list instead of 404 so front-end pages can handle empty states gracefully
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No applications found matching the criteria.',
      count: 0,
      applications: [],
      timestamp: new Date().toISOString(),
    });
  }

  // Normalize applications so front-end can read `application.job` and `application.candidate`
  const formattedApplications = applications.map(formatApplicationForResponse);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Applications retrieved successfully.',
    count: formattedApplications.length,
    applications: formattedApplications,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get application by ID
 *
 * @route GET /api/v1/applications/:id
 * @access Private (Recruiter, Admin)
 *
 * @param {Object} req - The request object containing the application ID.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getApplicationById = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate('jobId', 'title company category location')
    .populate('candidateId', 'firstName lastName email');

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'No application found with the specified ID. Please try again.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Application details retrieved successfully.',
    application: formatApplicationForResponse(application),
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get job's applications
 *
 * @route GET /api/v1/applications/job/:jobId
 * @access Private
 *
 * @param {Object} req - The request object containing the job ID.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getApplicationsByJobId = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.jobId);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The requested job posting could not be found.');
  }

  const applications = await Application.find({ jobId: req.params.jobId })
    .populate('jobId', 'title company category location')
    .populate('candidateId', 'firstName lastName email');

  if (!applications || applications.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No applications have been submitted for this job posting yet.',
      count: 0,
      applications: [],
      timestamp: new Date().toISOString(),
    });
  }

  const formattedApplications = applications.map(formatApplicationForResponse);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Job applications retrieved successfully.',
    count: formattedApplications.length,
    applications: formattedApplications,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Update application
 *
 * @route PUT /api/v1/applications/:id
 * @access Private (Recruiter, Admin)
 *
 * @param {Object} req - The request object containing the application ID.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 *
 */

const updateApplication = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['applied', 'shortlisted', 'rejected', 'hired'];

  if (!validStatuses.includes(status)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide a valid application status.');
  }

  const application = await Application.findById(req.params.id)
    .populate('candidateId')
    .populate({
      path: 'jobId',
      populate: {
        path: 'recruiterId'
      }
    });

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Unable to locate the specified application.');
  }

  if (req.user.isRecruiter && application.jobId.recruiterId._id.toString() !== req.user.id) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You do not have permission to update this application.');
  }

  const updatedApplication = await Application.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate('candidateId').populate({
    path: 'jobId',
    populate: {
      path: 'recruiterId'
    }
  });

  if (!updatedApplication) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Failed to update application status. Please try again.');
  }

  const emailContent = [
    {
      type: 'heading',
      value: 'Application Status Update',
    },
    {
      type: 'text',
      value: `The status of your application for the position of <strong>${application.jobId.title}</strong> has been updated to <strong>${status}</strong>.`,
    },
    {
      type: 'heading',
      value: 'Application Details',
    },
    {
      type: 'list',
      value: [
        `Job Title: ${application.jobId.title}`,
        `Job Location: ${application.jobId.location}`,
        `Application Date: ${new Date(
          application.applicationDate
        ).toLocaleDateString()}`,
        `Current Status: ${status.charAt(0).toUpperCase() +
        status.slice(1)
        }`,
      ],
    },
    {
      type: 'cta',
      value: {
        text: 'View Application',
        link: `${process.env.CLIENT_URL}/applications/${application._id}`,
      },
    },
    {
      type: 'text',
      value:
        'If you have any questions or need assistance, our support team is always ready to help.',
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: application.candidateId.email,
      subject: 'EZY Jobs - Application Status Update',
      html: generateEmailTemplate({
        firstName: application.candidateId.firstName,
        subject: 'Application Status Update',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: application.jobId.recruiterId.email,
      subject: 'EZY Jobs - Application Status Update',
      html: generateEmailTemplate({
        firstName: application.jobId.recruiterId.firstName,
        subject: 'Application Status Update',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Application updated but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Application status updated successfully.',
    application: formatApplicationForResponse(updatedApplication),
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Delete application
 *
 * @route DELETE /api/v1/applications/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object containing the application ID.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const deleteApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Application record not found. Please check and try again later.'
    );
  }

  const deletedApplication = await Application.findByIdAndDelete(req.params.id);

  if (!deletedApplication) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to delete application. Please try again later.');
  }

  const [candidate, job] = await Promise.all([
    User.findById(application.candidateId),
    Job.findById(application.jobId),
  ]);

  const recruiter = await User.findById(job.recruiterId);

  const emailContent = [
    {
      type: 'heading',
      value: 'Application Record Deleted',
    },
    {
      type: 'text',
      value: `This application record has been permanently removed from the system.`,
    },
    {
      type: 'heading',
      value: 'Application Details',
    },
    {
      type: 'list',
      value: [
        `Job Title: ${job.title}`,
        `Company: ${job.company}`,
        `Candidate: ${candidate.firstName} ${candidate.lastName}`,
        `Application Date: ${new Date(
          application.applicationDate
        ).toLocaleString()}`,
        `Status: ${application.status}`,
      ],
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: recruiter.email,
      subject: 'EZY Jobs - Application Record Deleted',
      html: generateEmailTemplate({
        firstName: recruiter.firstName,
        subject: 'Application Record Deleted',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: candidate.email,
      subject: 'EZY Jobs - Application Record Deleted',
      html: generateEmailTemplate({
        firstName: candidate.firstName,
        subject: 'Application Record Deleted',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Application record deleted but email could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Application record has been successfully deleted',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createApplication,
  getAllApplications,
  getApplicationById,
  getApplicationsByJobId,
  updateApplication,
  deleteApplication,
};