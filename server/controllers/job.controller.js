const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');
const axios = require('axios');

const { User, Job } = require('../models');

const { validateString, validateArray } = require('../utils/validation.utils');
const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');

const convertToArray = (value) => {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

// Simple slug generator
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Ensure slug uniqueness by appending timestamp if duplicate
const generateUniqueSlug = async (base, JobModel) => {
  let slug = slugify(base || 'job');
  // Check for existing slug
  const exists = await JobModel.findOne({ 'seo.slug': slug }).lean();
  if (!exists) return slug;
  // Append timestamp to guarantee uniqueness
  return `${slug}-${Date.now()}`;
};

/**
 * @desc Creates a new job.
 *
 * @route POST /api/v1/jobs
 * @access Private (Recruiter)
 *
 * @param {Object} req - The request object containing the OTP.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    requirements,
    benefits,
    company,
    salaryRange,
    category,
    location,
  } = req.body;
  const recruiterId = req.user.id;

  const recruiter = await User.findById(recruiterId);

  if (!recruiter) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Unable to find recruiter account. Please try again.');
  }

  if (
    !title ||
    !description ||
    !requirements ||
    !benefits ||
    !company ||
    !salaryRange ||
    !category ||
    !location
  ) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please fill in all required fields to create a job posting.'
    );
  }

  const requirementsArray = convertToArray(requirements);
  const validatedRequirements = validateArray(
    res,
    requirementsArray,
    'Requirements',
    1,
    20
  );

  const benefitsArray = convertToArray(benefits);
  const validatedBenefits = validateArray(
    res,
    benefitsArray,
    'Benefits',
    1,
    20
  );

  const requirementsJson = JSON.stringify(validatedRequirements);
  const benefitsJson = JSON.stringify(validatedBenefits);

  if (requirementsJson.length < 50 || requirementsJson.length > 2000) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Requirements content must be between 50 and 2000 characters when formatted.'
    );
  }

  if (benefitsJson.length < 50 || benefitsJson.length > 2000) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Benefits content must be between 50 and 2000 characters when formatted.'
    );
  }

  const validatedData = {
    title: validateString(res, title, 'Title', 2, 100),
    description: validateString(res, description, 'Description', 50, 5000),
    requirements: validatedRequirements, // Store as array in MongoDB
    benefits: validatedBenefits, // Store as array in MongoDB
    company: validateString(res, company, 'Company', 2, 100),
    salaryRange: validateString(res, salaryRange, 'Salary Range', 2, 100),
    category: validateString(res, category, 'Category', 2, 100),
    location: validateString(res, location, 'Location', 2, 100),
    recruiterId,
    isClosed: false,
  };

  // Generate SEO slug to avoid duplicate-null unique index errors
  try {
    const slug = await generateUniqueSlug(validatedData.title, Job);
    validatedData.seo = { slug };
  } catch (err) {
    // Fallback: attach timestamp-based slug
    validatedData.seo = { slug: `${slugify(validatedData.title)}-${Date.now()}` };
  }

  let job;
  try {
    job = await Job.create(validatedData);
  } catch (err) {
    // Handle duplicate key errors (e.g., seo.slug unique index)
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      // If duplicate key is caused by seo.slug:null (multiple nulls in unique index), try to backfill a unique slug and retry
      const dupKey = err.keyValue ? Object.keys(err.keyValue)[0] : null;
      const errMsg = err.message || '';

      const isSeoNullDup = dupKey === 'seo.slug' || /seo\.slug/.test(errMsg);

      if (isSeoNullDup) {
        // Create a safe unique slug and retry once
        validatedData.seo = {
          slug: `${slugify(validatedData.title)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        };

        try {
          job = await Job.create(validatedData);
        } catch (retryErr) {
          // If retry still fails with duplicate key, return friendly conflict
          if (retryErr && (retryErr.code === 11000 || retryErr.name === 'MongoServerError')) {
            res.status(StatusCodes.CONFLICT);
            const key = retryErr.keyValue ? Object.keys(retryErr.keyValue).join(', ') : 'unique field';
            throw new Error(
              `A record with the same ${key} already exists. Please modify the title or other unique fields and try again.`
            );
          }
          throw retryErr;
        }
      }

      res.status(StatusCodes.CONFLICT);
      const key = err.keyValue ? Object.keys(err.keyValue).join(', ') : 'unique field';
      throw new Error(
        `A record with the same ${key} already exists. Please modify the title or other unique fields and try again.`
      );
    }
    // Re-throw other errors to be handled by global error handler
    throw err;
  }

  if (!job) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Unable to create job posting. Please try again.');
  }

  const requirementsDisplay = Array.isArray(job.requirements) 
    ? job.requirements.join(', ') 
    : job.requirements;
  const benefitsDisplay = Array.isArray(job.benefits) 
    ? job.benefits.join(', ') 
    : job.benefits;

  const jobData = {
    ...job.toObject(),
    requirements: requirementsDisplay,
    benefits: benefitsDisplay,
  };

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: recruiter.email,
    subject: 'EZY Jobs - New Job Created Successfully',
    html: generateEmailTemplate({
      firstName: recruiter.firstName,
      subject: 'EZY Jobs - New Job Created Successfully',
      content: [
        {
          type: 'heading',
          value: 'Job Creation Complete!',
        },
        {
          type: 'text',
          value:
            'Congratulations! Your job posting has been successfully created on EZY Jobs and is now live for candidates to view and apply.',
        },
        {
          type: 'heading',
          value: 'Job Details',
        },
        {
          type: 'list',
          value: [
            `Title: ${job.title}`,
            `Description: ${job.description}`,
            `Requirements: ${requirementsDisplay}`,
            `Benefits: ${benefitsDisplay}`,
            `Company: ${job.company}`,
            `Salary Range: ${job.salaryRange}`,
            `Category: ${job.category}`,
            `Location: ${job.location}`,
          ],
        },
        {
          type: 'heading',
          value: 'Next Steps',
        },
        {
          type: 'list',
          value: [
            'Review applications as they come in',
            'Schedule interviews with promising candidates',
            'Update the job posting if needed',
            'Share the job on your professional networks',
          ],
        },
        {
          type: 'cta',
          value: {
            text: 'View Your Job Posting',
            link: `${process.env.CLIENT_URL}/jobs/${job._id}`,
          },
        },
        {
          type: 'text',
          value:
            'If you need any assistance with your job posting, our support team is here to help.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Job created successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Job posting created successfully',
    job: jobData,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Gets all Job.
 *
 * @route GET /api/v1/jobs
 * @access Public
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getAllJobs = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    location,
    company,
    salaryRange,
    isClosed,
    limit,
    recruiterId,
  } = req.query;
  let query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { requirements: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) query.category = { $regex: category, $options: 'i' };
  if (location) query.location = { $regex: location, $options: 'i' };
  if (company) query.company = { $regex: company, $options: 'i' };
  if (salaryRange) query.salaryRange = { $regex: salaryRange, $options: 'i' };
  if (isClosed !== undefined) query.isClosed = isClosed === 'true';
  if (recruiterId) query.recruiterId = recruiterId;

  const jobs = await Job.find(query)
    .populate('recruiterId', 'firstName lastName email')
    .limit(limit ? parseInt(limit) : 0);

  if (!jobs || jobs.length === 0) {
    // Return an empty list instead of throwing an error so clients can
    // handle zero-results without receiving a server error status.
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No jobs match your search criteria. Try adjusting your filters.',
      count: 0,
      jobs: [],
      timestamp: new Date().toISOString(),
    });
  }

  const jobsData = jobs.map((job) => {
    const requirementsDisplay = Array.isArray(job.requirements) 
      ? job.requirements.join(', ') 
      : job.requirements;
    const benefitsDisplay = Array.isArray(job.benefits) 
      ? job.benefits.join(', ') 
      : job.benefits;

    return {
      ...job.toObject(),
      recruiter: job.recruiterId,
      requirements: requirementsDisplay,
      benefits: benefitsDisplay,
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Found ${jobs.length} opportunities matching your search`,
    count: jobs.length,
    jobs: jobsData,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Gets the job with the specified ID.
 *
 * @route GET /api/v1/jobs/:id
 * @access Private
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getJobById = asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  const job = await Job.findById(jobId).populate('recruiterId', 'firstName lastName email');

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('This job posting no longer exists or has been removed.');
  }

  const requirementsDisplay = Array.isArray(job.requirements) 
    ? job.requirements.join(', ') 
    : job.requirements;
  const benefitsDisplay = Array.isArray(job.benefits) 
    ? job.benefits.join(', ') 
    : job.benefits;

  const jobData = {
    ...job.toObject(),
    recruiter: job.recruiterId,
    requirements: requirementsDisplay,
    benefits: benefitsDisplay,
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Job details retrieved successfully',
    job: jobData,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Updates the job with the specified ID.
 *
 * @route PATCH /api/v1/jobs/:id
 * @access Private (Recruiter, Admin)
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const updateJobById = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    requirements,
    benefits,
    company,
    salaryRange,
    category,
    location,
    isClosed,
  } = req.body;
  const jobId = req.params.id;

  if (
    !title &&
    !description &&
    !requirements &&
    !benefits &&
    !company &&
    !salaryRange &&
    !category &&
    !location &&
    typeof isClosed === 'undefined'
  ) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please provide at least one field to update the job posting.'
    );
  }

  const job = await Job.findById(jobId).populate('recruiterId', 'firstName lastName email');

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job posting not found. Please check and try again.');
  }

  let validatedData = {};

  if (title) validatedData.title = validateString(res, title, 'Title', 2, 100);
  if (description) validatedData.description = validateString(res, description, 'Description', 50, 5000);
  if (company) validatedData.company = validateString(res, company, 'Company', 2, 100);
  if (salaryRange) validatedData.salaryRange = validateString(res, salaryRange, 'Salary Range', 2, 100);
  if (category) validatedData.category = validateString(res, category, 'Category', 2, 100);
  if (location) validatedData.location = validateString(res, location, 'Location', 2, 100);
  if (typeof isClosed !== 'undefined') validatedData.isClosed = isClosed;

  if (requirements) {
    const requirementsArray = convertToArray(requirements);
    const validatedRequirements = validateArray(
      res,
      requirementsArray,
      'Requirements',
      1,
      20
    );
    validatedData.requirements = validatedRequirements;
  }

  if (benefits) {
    const benefitsArray = convertToArray(benefits);
    const validatedBenefits = validateArray(
      res,
      benefitsArray,
      'Benefits',
      1,
      20
    );
    validatedData.benefits = validatedBenefits;
  }

  // If title changed, regenerate SEO slug
  if (title) {
    try {
      const slug = await generateUniqueSlug(validatedData.title || title, Job);
      validatedData.seo = { slug };
    } catch (err) {
      validatedData.seo = { slug: `${slugify(validatedData.title || title)}-${Date.now()}` };
    }
  }

  let updatedJob;
  try {
    updatedJob = await Job.findByIdAndUpdate(jobId, validatedData, { new: true }).populate('recruiterId', 'firstName lastName email');
  } catch (err) {
    if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
      res.status(StatusCodes.CONFLICT);
      const key = err.keyValue ? Object.keys(err.keyValue).join(', ') : 'unique field';
      throw new Error(
        `Unable to update job because a record with the same ${key} already exists. Please change the conflicting field and try again.`
      );
    }
    throw err;
  }

  if (!updatedJob) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Unable to update job posting. Please try again.');
  }

  if (!job.isClosed && updatedJob.isClosed === true && req.user.isRecruiter) {
    // Trigger internal shortlisting using the internal API key when available
    const headers = {
      'Content-Type': 'application/json',
    };

    // Prefer internal token for server-to-server auth
    if (process.env.INTERNAL_API_KEY) {
      headers['x-internal-token'] = process.env.INTERNAL_API_KEY;
    } else if (req.headers.authorization && req.headers.authorization.split(' ')[1]) {
      headers['Authorization'] = `Bearer ${req.headers.authorization.split(' ')[1]}`;
    }

    axios
      .post(
        `${process.env.SERVER_URL || 'http://localhost:5000'}/api/v1/ai/shortlist/${jobId}`,
        {},
        {
          headers,
          timeout: 60000,
        }
      )
      .catch((error) => {
        console.error('Failed to trigger automatic candidate shortlisting:', error && (error.message || error));
      });
  }

  const requirementsDisplay = Array.isArray(updatedJob.requirements) 
    ? updatedJob.requirements.join(', ') 
    : updatedJob.requirements;
  const benefitsDisplay = Array.isArray(updatedJob.benefits) 
    ? updatedJob.benefits.join(', ') 
    : updatedJob.benefits;

  const jobData = {
    ...updatedJob.toObject(),
    recruiter: updatedJob.recruiterId,
    requirements: requirementsDisplay,
    benefits: benefitsDisplay,
  };

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: updatedJob.recruiterId.email,
    subject: 'EZY Jobs - Job Updated',
    html: generateEmailTemplate({
      firstName: updatedJob.recruiterId.firstName,
      subject: 'EZY Jobs - Job Updated',
      content: [
        {
          type: 'heading',
          value: 'Job Update Complete!',
        },
        {
          type: 'text',
          value:
            'Your job posting has been successfully updated on EZY Jobs and is now live for candidates to view and apply.',
        },
        {
          type: 'heading',
          value: 'Updated Job Details',
        },
        {
          type: 'list',
          value: [
            `Title: ${updatedJob.title}`,
            `Description: ${updatedJob.description}`,
            `Requirements: ${requirementsDisplay}`,
            `Benefits: ${benefitsDisplay}`,
            `Company: ${updatedJob.company}`,
            `Salary Range: ${updatedJob.salaryRange}`,
            `Category: ${updatedJob.category}`,
            `Location: ${updatedJob.location}`,
          ],
        },
        {
          type: 'heading',
          value: 'Next Steps',
        },
        {
          type: 'list',
          value: [
            'Review applications as they come in',
            'Schedule interviews with promising candidates',
            'Update the job posting if needed',
            'Share the job on your professional networks',
          ],
        },
        {
          type: 'cta',
          value: {
            text: 'View Your Job Posting',
            link: `${process.env.CLIENT_URL}/jobs/${updatedJob._id}`,
          },
        },
        {
          type: 'text',
          value:
            'If you need any assistance with your job posting, our support team is here to help.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Job updated successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Job posting updated successfully',
    job: jobData,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Deletes the job with the specified ID.
 *
 * @route DELETE /api/v1/jobs/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const deleteJobById = asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  const job = await Job.findById(jobId).populate('recruiterId', 'firstName lastName email');

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job posting not found. Please check and try again.');
  }

  const deletedJob = await Job.findByIdAndDelete(jobId);

  if (!deletedJob) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Unable to delete job posting. Please try again.');
  }

  const requirementsDisplay = Array.isArray(deletedJob.requirements) 
    ? deletedJob.requirements.join(', ') 
    : deletedJob.requirements;
  const benefitsDisplay = Array.isArray(deletedJob.benefits) 
    ? deletedJob.benefits.join(', ') 
    : deletedJob.benefits;

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: job.recruiterId.email,
    subject: 'EZY Jobs - Job Deleted',
    html: generateEmailTemplate({
      firstName: job.recruiterId.firstName,
      subject: 'EZY Jobs - Job Deleted',
      content: [
        {
          type: 'heading',
          value: 'Job Deletion Complete!',
        },
        {
          type: 'text',
          value:
            'Your job posting has been successfully deleted from EZY Jobs. If you did not initiate this action, please contact our support team immediately.',
        },
        {
          type: 'heading',
          value: 'Deleted Job Details',
        },
        {
          type: 'list',
          value: [
            `Title: ${job.title}`,
            `Description: ${job.description}`,
            `Requirements: ${requirementsDisplay}`,
            `Benefits: ${benefitsDisplay}`,
            `Company: ${job.company}`,
            `Salary Range: ${job.salaryRange}`,
            `Category: ${job.category}`,
            `Location: ${job.location}`,
          ],
        },
        {
          type: 'text',
          value:
            'If you did not delete this job posting, please contact our support team immediately to secure your account.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Job deleted successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Job posting deleted successfully',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJobById,
  deleteJobById,
};