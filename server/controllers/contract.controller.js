const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const {
  Contract,
  ChatRoom,
  InterviewerRating,
  Job,
  Transaction,
  User,
} = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');
const { validateString } = require('../utils/validation.utils');

/**
 * @desc Create a new contract
 *
 * @route POST /api/contracts
 * @access Private (Recruiters, Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const createContract = asyncHandler(async (req, res) => {
  const { jobId, agreedPrice, recruiterId, interviewerId, roomId } = req.body;

  if (!jobId || !agreedPrice || !recruiterId || !interviewerId || !roomId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please fill in all required fields to create a contract.');
  }

  if (isNaN(parseFloat(agreedPrice)) || parseFloat(agreedPrice) <= 0) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Agreed price must be a positive number.');
  }

  const [job, recruiter, interviewer, chatRoom] = await Promise.all([
    Job.findById(jobId),
    User.findById(recruiterId),
    User.findById(interviewerId),
    ChatRoom.findById(roomId),
  ]);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job not found. Please check and try again.');
  }

  if (!recruiter) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Recruiter not found. Please check and try again.');
  }

  if (!interviewer) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Interviewer not found. Please check and try again.');
  }

  if (!chatRoom) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Chat room not found. Please check and try again.');
  }

  if (!recruiter.isRecruiter) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Selected user is not a recruiter. Please verify the user role.'
    );
  }

  if (!interviewer.isInterviewer) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Selected user is not an interviewer. Please verify the user role.'
    );
  }

  const existingContract = await Contract.findOne({
    jobId,
    recruiterId,
    interviewerId,
  });

  if (existingContract) {
    res.status(StatusCodes.CONFLICT);
    throw new Error(
      'A contract already exists between these parties for this job.'
    );
  }

  const contract = await Contract.create({
    jobId,
    agreedPrice,
    recruiterId,
    interviewerId,
    roomId,
    status: 'pending',
    paymentStatus: 'pending',
  });

  if (!contract) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Unable to create contract. Please try again.');
  }

  const emailContent = [
    { type: 'heading', value: 'New Contract Created!' },
    {
      type: 'text',
      value:
        'A new contract has been successfully created for your job posting.',
    },
    {
      type: 'heading',
      value: 'Contract Details',
    },
    {
      type: 'list',
      value: [
        `Job Title: ${job.title}`,
        `Recruiter: ${recruiter.firstName} ${recruiter.lastName}`,
        `Interviewer: ${interviewer.firstName} ${interviewer.lastName}`,
        `Agreed Price: $${agreedPrice}`,
        `Status: ${contract.status}`,
        `Payment Status: ${contract.paymentStatus}`,
      ],
    },
    {
      type: 'heading',
      value: 'Next Steps',
    },
    {
      type: 'list',
      value: [
        'Review the contract details',
        'Communicate with the other party',
        'Prepare for the upcoming interview',
        'Track the contract status in your dashboard',
      ],
    },
    {
      type: 'cta',
      value: {
        text: 'View Contract Details',
        link: `${process.env.CLIENT_URL}/contracts/${contract._id}`,
      },
    },
    {
      type: 'text',
      value:
        'If you have any questions or need assistance, please contact our support team.',
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: recruiter.email,
      subject: 'EZY Jobs - New Contract Created',
      html: generateEmailTemplate({
        firstName: recruiter.firstName,
        subject: 'New Contract Created',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: interviewer.email,
      subject: 'EZY Jobs - New Contract Created',
      html: generateEmailTemplate({
        firstName: interviewer.firstName,
        subject: 'New Contract Created',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Contract created successfully but notification email could not be delivered.'
    );
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Contract created successfully',
    contract,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get all contracts
 *
 * @route GET /api/contracts
 * @access Private
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const getAllContracts = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    paymentStatus,
    recruiterId,
    interviewerId,
    jobId,
    limit,
  } = req.query;
  const user = req.user;
  let query = {};

  // FIXED: Add role-based filtering for contracts
  // CRASH CAUSE: Recruiters and interviewers could see all contracts
  // SOLUTION: Filter contracts based on user role
  if (user) {
    // Recruiters can ONLY see their own contracts
    if (user.isRecruiter && !user.isAdmin) {
      query.recruiterId = user.id;
    }
    // Interviewers can ONLY see contracts assigned to them
    else if (user.isInterviewer && !user.isRecruiter && !user.isAdmin) {
      query.interviewerId = user.id;
    }
    // Admins can see all contracts (no additional filter)
  }

  if (search) {
    query.$or = [
      { 'job.title': { $regex: search, $options: 'i' } },
      { 'job.description': { $regex: search, $options: 'i' } },
    ];
  }

  if (status) query.status = { $regex: status, $options: 'i' };
  if (paymentStatus) query.paymentStatus = { $regex: paymentStatus, $options: 'i' };
  // Only allow manual filters for admins or if matching user's own ID
  if (recruiterId && (user?.isAdmin || (user?.isRecruiter && recruiterId === user.id.toString()))) {
    query.recruiterId = recruiterId;
  }
  if (interviewerId && (user?.isAdmin || (user?.isInterviewer && interviewerId === user.id.toString()))) {
    query.interviewerId = interviewerId;
  }
  if (jobId) query.jobId = jobId;

  const contracts = await Contract.find(query)
    .populate('jobId', 'title description isClosed')
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email payoutEnabled stripeAccountId')
    .populate('roomId')
    .populate('interviewerRatings', 'rating feedback createdAt')
    .populate('transactions', 'amount status transactionDate transactionType')
    .limit(limit ? parseInt(limit) : 0);

  if (!contracts || contracts.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No contracts found. Please try different search criteria or check back later.',
      count: 0,
      contracts: [],
      timestamp: new Date().toISOString(),
    });
  }

  // FIXED: Normalize contracts to ensure populated fields exist
  // CRASH CAUSE: jobId, interviewerId, recruiterId might be null/undefined after populate
  // SOLUTION: Transform contracts to ensure safe structure with defaults
  const normalizedContracts = contracts.map((contract) => {
    const contractObj = contract.toObject ? contract.toObject() : contract;
    return {
      ...contractObj,
      id: contractObj._id || contractObj.id,
      job: contractObj.jobId || { title: 'Job Not Found', description: '', isClosed: false },
      interviewer: contractObj.interviewerId || {
        firstName: 'Unknown',
        lastName: '',
        email: 'N/A',
        payoutEnabled: false,
        stripeAccountId: null,
      },
      recruiter: contractObj.recruiterId || {
        firstName: 'Unknown',
        lastName: '',
        email: 'N/A',
      },
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Successfully retrieved ${normalizedContracts.length} contracts`,
    count: normalizedContracts.length,
    contracts: normalizedContracts,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get a contract by ID
 *
 * @route GET /api/contracts/:id
 * @access Private (Recruiters, Interviewers, Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const getContractById = asyncHandler(async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate('jobId', 'title description isClosed')
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email')
    .populate('roomId')
    .populate('interviewerRatings', 'rating feedback createdAt')
    .populate('transactions', 'amount status transactionDate transactionType');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found. Please check and try again.');
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Contract found',
    contract,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Update a contract by ID
 *
 * @route PUT /api/contracts/:id
 * @access Private (Recruiters, Interviewers, Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const updateContractById = asyncHandler(async (req, res) => {
  const { agreedPrice, status, paymentStatus } = req.body;

  if (!agreedPrice && !status && !paymentStatus) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please provide at least one field to update the contract.'
    );
  }

  const contract = await Contract.findById(req.params.id)
    .populate('jobId')
    .populate('recruiterId')
    .populate('interviewerId')
    .populate('roomId');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Contract not found. Please verify the contract ID and try again.'
    );
  }

  if (agreedPrice) {
    if (isNaN(parseFloat(agreedPrice)) || parseFloat(agreedPrice) <= 0) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error(
        'Agreed price must be a positive number. Please enter a valid amount.'
      );
    }

    if (parseFloat(agreedPrice) > 1000000) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Agreed price cannot exceed 1,000,000.');
    }
  }

  if (status) {
    const validStatuses = ['pending', 'active', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error(
        `Invalid contract status. Status must be one of: ${validStatuses.join(
          ', '
        )}`
      );
    }
  }

  if (paymentStatus) {
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

    if (!validPaymentStatuses.includes(paymentStatus)) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error(
        `Invalid payment status. Payment status must be one of: ${validPaymentStatuses.join(
          ', '
        )}`
      );
    }
  }

  const updateData = {};
  if (agreedPrice) updateData.agreedPrice = agreedPrice;
  if (status) updateData.status = status;
  if (paymentStatus) updateData.paymentStatus = paymentStatus;

  const updatedContract = await Contract.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  );

  if (!updatedContract) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'We encountered an issue updating your contract. Please try again later.'
    );
  }

  const emailContent = [
    { type: 'heading', value: 'Contract Updated Successfully' },
    {
      type: 'text',
      value:
        'The contract details have been updated. Please review the new information below:',
    },
    {
      type: 'heading',
      value: 'Updated Contract Details',
    },
    {
      type: 'list',
      value: [
        `Job Title: ${contract.jobId.title}`,
        `Recruiter: ${contract.recruiterId.firstName} ${contract.recruiterId.lastName}`,
        `Interviewer: ${contract.interviewerId.firstName} ${contract.interviewerId.lastName}`,
        `Agreed Price: $${updatedContract.agreedPrice}`,
        `Status: ${updatedContract.status}`,
        `Payment Status: ${updatedContract.paymentStatus}`,
      ],
    },
    {
      type: 'text',
      value:
        'Please review these changes and contact us if you have any questions or concerns.',
    },
    {
      type: 'cta',
      value: {
        text: 'View Contract Details',
        link: `${process.env.CLIENT_URL}/contracts/${contract._id}`,
      },
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.recruiterId.email,
      subject: 'EZY Jobs - Contract Updated',
      html: generateEmailTemplate({
        firstName: contract.recruiterId.firstName,
        subject: 'Contract Updated',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.interviewerId.email,
      subject: 'EZY Jobs - Contract Updated',
      html: generateEmailTemplate({
        firstName: contract.interviewerId.firstName,
        subject: 'Contract Updated',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Contract updated successfully but notification email could not be delivered.'
    );
  }

  const refreshedContract = await Contract.findById(req.params.id)
    .populate('jobId', 'title description isClosed')
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email')
    .populate('roomId')
    .populate('interviewerRatings', 'rating feedback createdAt')
    .populate('transactions', 'amount status transactionDate transactionType');

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Contract updated successfully!',
    contract: refreshedContract,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Delete a contract by ID
 *
 * @route DELETE /api/contracts/:id
 * @access Private (Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const deleteContractById = asyncHandler(async (req, res) => {
  const contract = await Contract.findById(req.params.id)
    .populate('jobId', 'title description')
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email')
    .populate('roomId');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found. Please check and try again.');
  }

  const isDeleted = await Contract.findByIdAndDelete(req.params.id);

  if (!isDeleted) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Unable to delete contract. Please try again later.');
  }

  const emailContent = [
    {
      type: 'heading',
      value: 'Contract Record Deleted',
    },
    {
      type: 'text',
      value:
        'This contract record has been permanently removed from the system.',
    },
    {
      type: 'heading',
      value: 'Contract Details',
    },
    {
      type: 'list',
      value: [
        `Job Title: ${contract.jobId.title}`,
        `Recruiter: ${contract.recruiterId.firstName} ${contract.recruiterId.lastName}`,
        `Interviewer: ${contract.interviewerId.firstName} ${contract.interviewerId.lastName}`,
        `Agreed Price: $${contract.agreedPrice}`,
        `Status: ${contract.status}`,
        `Payment Status: ${contract.paymentStatus}`,
      ],
    },
    {
      type: 'text',
      value:
        'If you believe this was done in error, please contact the administrator.',
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.recruiterId.email,
      subject: 'EZY Jobs - Contract Record Deleted',
      html: generateEmailTemplate({
        firstName: contract.recruiterId.firstName,
        subject: 'Contract Record Deleted',
        content: emailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.interviewerId.email,
      subject: 'EZY Jobs - Contract Record Deleted',
      html: generateEmailTemplate({
        firstName: contract.interviewerId.firstName,
        subject: 'Contract Record Deleted',
        content: emailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Contract deleted successfully but notification email could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Contract deleted successfully',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get contracts by job ID
 *
 * @route GET /api/contracts/job/:jobId
 * @access Private (Recruiters, Interviewers, Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @return {Promise<void>}
 */

const getContractsByJobId = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;

  if (!jobId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide a job ID to retrieve contracts.');
  }

  const job = await Job.findById(jobId);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Job not found. Please check and try again.');
  }

  const contracts = await Contract.find({ jobId: req.params.jobId })
    .populate('jobId', 'title description isClosed')
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email')
    .populate('roomId')
    .populate('interviewerRatings', 'rating feedback createdAt')
    .populate('transactions', 'amount status transactionDate transactionType');

  if (!contracts || contracts.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No contracts found for this job. Please check back later.',
      count: 0,
      contracts: [],
      timestamp: new Date().toISOString(),
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Successfully retrieved ${contracts.length} contracts for this job`,
    count: contracts.length,
    contracts,
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createContract,
  getAllContracts,
  getContractById,
  updateContractById,
  deleteContractById,
  getContractsByJobId,
};