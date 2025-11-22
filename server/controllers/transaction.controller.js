const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const { Contract, Transaction, User } = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');
const { validateString } = require('../utils/validation.utils');

/**
 * @desc   Create new transaction
 *
 * @route  POST /api/transactions
 * @access Private (Recruiter, Interviewer)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const createTransaction = asyncHandler(async (req, res) => {
  const { contractId, amount, status } = req.body;

  if (!validateString(res, contractId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please provide a valid Contract ID.');
  }

  if (
    !status ||
    !['pending', 'completed', 'failed', 'cancelled'].includes(status)
  ) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Please provide a valid status: pending, completed, failed, or cancelled.'
    );
  }

  const contract = await Contract.findOne({
    _id: contractId,
    status: { $in: ['active', 'completed'] }
  })
    .populate('recruiterId')
    .populate('interviewerId');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Contract not found. Please check the details and try again.'
    );
  }

  const transaction = await Transaction.create({
    contractId,
    amount,
    status,
    transactionDate: new Date(),
  });

  if (!transaction) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Unable to process transaction. Please try again later.');
  }

  const commonListItems = [
    `Transaction Amount: $${amount}`,
    `Status: ${status}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `Contract ID: ${contractId}`,
  ];

  const recruiterEmailContent = [
    {
      type: 'text',
      value: `Hello ${contract.recruiterId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Processed Successfully',
    },
    {
      type: 'text',
      value: 'Your transaction has been processed with the following details:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value: 'Please check your account for the updated balance.',
    },
    {
      type: 'cta',
      value: {
        text: 'View Transaction Details',
        link: `${process.env.CLIENT_URL}/transactions/${transaction._id}`,
      },
    },
  ];

  const interviewerEmailContent = [
    {
      type: 'text',
      value: `Hello ${contract.interviewerId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Processed Successfully',
    },
    {
      type: 'text',
      value: 'Your transaction has been processed with the following details:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value: 'Please check your account for the updated balance.',
    },
    {
      type: 'cta',
      value: {
        text: 'View Transaction Details',
        link: `${process.env.CLIENT_URL}/transactions/${transaction._id}`,
      },
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.recruiterId.email,
      subject: 'EZY Jobs - Transaction Processed',
      html: generateEmailTemplate({
        firstName: contract.recruiterId.firstName,
        subject: 'EZY Jobs - Transaction Processed',
        content: recruiterEmailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: contract.interviewerId.email,
      subject: 'EZY Jobs - Transaction Processed',
      html: generateEmailTemplate({
        firstName: contract.interviewerId.firstName,
        subject: 'EZY Jobs - Transaction Processed',
        content: interviewerEmailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Transaction processed successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.CREATED).json({
    transaction,
    success: true,
    message: 'Transaction processed successfully',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc   Get all transactions
 *
 * @route  GET /api/transactions
 * @access Private (Admin, Recruiter, Interviewer)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getAllTransactions = asyncHandler(async (req, res) => {
  const {
    status,
    contractId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    limit,
  } = req.query;
  let query = {};

  if (status) {
    query.status = status;
  }

  if (contractId) query.contractId = contractId;

  if (startDate && endDate) {
    query.transactionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  } else if (startDate) {
    query.transactionDate = { $gte: new Date(startDate) };
  } else if (endDate) {
    query.transactionDate = { $lte: new Date(endDate) };
  }

  if (minAmount && maxAmount) {
    query.amount = { $gte: minAmount, $lte: maxAmount };
  } else if (minAmount) {
    query.amount = { $gte: minAmount };
  } else if (maxAmount) {
    query.amount = { $lte: maxAmount };
  }

  const transactions = await Transaction.find(query)
    .populate({
      path: 'contractId',
      populate: [
        {
          path: 'recruiterId',
          select: 'firstName lastName email'
        },
        {
          path: 'interviewerId',
          select: 'firstName lastName email'
        }
      ]
    })
    .limit(limit ? parseInt(limit) : 0);

  if (!transactions || transactions.length === 0) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'No transactions found. Try modifying your search filters.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `${transactions.length} transactions retrieved successfully`,
    count: transactions.length,
    transactions,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc   Get transaction by ID
 *
 * @route  GET /api/transactions/:id
 * @access Private
 * @role   Admin, Recruiter, Interviewer
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getTransactionById = asyncHandler(async (req, res) => {
  const transactionId = req.params.id;

  if (!transactionId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Invalid transaction ID format. Please provide a valid ID.'
    );
  }

  const transaction = await Transaction.findById(transactionId)
    .populate({
      path: 'contractId',
      populate: [
        {
          path: 'recruiterId',
          select: 'firstName lastName email'
        },
        {
          path: 'interviewerId',
          select: 'firstName lastName email'
        }
      ]
    });

  if (!transaction) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Transaction not found. Please verify the ID and try again.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Transaction details retrieved successfully',
    transaction,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc   Update transaction by ID
 *
 * @route  PUT /api/transactions/:id
 * @access Private (Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const updateTransactionById = asyncHandler(async (req, res) => {
  const transactionId = req.params.id;
  const { amount, status } = req.body;

  if (!validateString(res, transactionId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Invalid transaction ID. Please provide a valid identifier.'
    );
  }

  if (amount !== undefined) {
    if (isNaN(amount) || parseFloat(amount) < 0) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error(
        'Transaction amount must be a valid number greater than or equal to 0.'
      );
    }
  }

  if (
    status &&
    !['pending', 'completed', 'failed', 'cancelled'].includes(status)
  ) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Invalid status selection. Please choose: pending, completed, failed, or cancelled.'
    );
  }

  const transaction = await Transaction.findById(transactionId)
    .populate({
      path: 'contractId',
      populate: [
        {
          path: 'recruiterId',
          select: 'firstName lastName email'
        },
        {
          path: 'interviewerId',
          select: 'firstName lastName email'
        }
      ]
    });

  if (!transaction) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Transaction not found. Please verify the details and try again.'
    );
  }

  const updateData = {};
  if (amount !== undefined) updateData.amount = amount;
  if (status) updateData.status = status;

  const updatedTransaction = await Transaction.findByIdAndUpdate(
    transactionId,
    updateData,
    { new: true }
  );

  if (!updatedTransaction) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to update transaction. Please try again later.');
  }

  const commonListItems = [
    `Transaction Amount: $${amount !== undefined ? amount : transaction.amount}`,
    `Status: ${status || transaction.status}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `Contract ID: ${transaction.contractId._id}`,
  ];

  const recruiterEmailContent = [
    {
      type: 'text',
      value: `Hello ${transaction.contractId.recruiterId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Updated',
    },
    {
      type: 'text',
      value: 'Your transaction has been updated with the following details:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value:
        'Please check your account for the latest transaction information.',
    },
    {
      type: 'cta',
      value: {
        text: 'View Transaction Details',
        link: `${process.env.CLIENT_URL}/transactions/${transaction._id}`,
      },
    },
  ];

  const interviewerEmailContent = [
    {
      type: 'text',
      value: `Hello ${transaction.contractId.interviewerId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Updated',
    },
    {
      type: 'text',
      value: 'A transaction related to your contract has been updated:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value:
        'Please check your account for the latest transaction information.',
    },
    {
      type: 'cta',
      value: {
        text: 'View Transaction Details',
        link: `${process.env.CLIENT_URL}/transactions/${transaction._id}`,
      },
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: transaction.contractId.recruiterId.email,
      subject: 'EZY Jobs - Transaction Updated',
      html: generateEmailTemplate({
        firstName: transaction.contractId.recruiterId.firstName,
        subject: 'EZY Jobs - Transaction Updated',
        content: recruiterEmailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: transaction.contractId.interviewerId.email,
      subject: 'EZY Jobs - Transaction Updated',
      html: generateEmailTemplate({
        firstName: transaction.contractId.interviewerId.firstName,
        subject: 'EZY Jobs - Transaction Updated',
        content: interviewerEmailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Transaction updated successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Transaction updated successfully',
    updatedTransaction,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc   Delete transaction by ID
 *
 * @route  DELETE /api/transactions/:id
 * @access Private (Admin)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const deleteTransactionById = asyncHandler(async (req, res) => {
  const transactionId = req.params.id;

  if (!validateString(res, transactionId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Invalid transaction ID. Please provide a valid identifier.'
    );
  }

  const transaction = await Transaction.findById(transactionId)
    .populate({
      path: 'contractId',
      populate: [
        {
          path: 'recruiterId',
          select: 'firstName lastName email'
        },
        {
          path: 'interviewerId',
          select: 'firstName lastName email'
        }
      ]
    });

  if (!transaction) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Transaction not found. Please verify the details and try again.'
    );
  }

  const isDeleted = await Transaction.findByIdAndDelete(transactionId);

  if (!isDeleted) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Failed to delete transaction. Please try again later.');
  }

  const commonListItems = [
    `Transaction ID: ${transaction._id}`,
    `Transaction Amount: $${transaction.amount}`,
    `Status: ${transaction.status}`,
    `Date of Transaction: ${transaction.transactionDate.toLocaleDateString()}`,
    `Contract ID: ${transaction.contractId._id}`,
  ];

  const recruiterEmailContent = [
    {
      type: 'text',
      value: `Hello ${transaction.contractId.recruiterId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Deleted',
    },
    {
      type: 'text',
      value: 'A transaction has been deleted with the following details:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value: 'This transaction has been removed from our system.',
    },
    {
      type: 'text',
      value:
        'If you have any questions about this action, please contact our support team.',
    },
  ];

  const interviewerEmailContent = [
    {
      type: 'text',
      value: `Hello ${transaction.contractId.interviewerId.firstName},`,
    },
    {
      type: 'heading',
      value: 'Transaction Deleted',
    },
    {
      type: 'text',
      value: 'A transaction related to your contract has been deleted:',
    },
    {
      type: 'list',
      value: commonListItems,
    },
    {
      type: 'text',
      value: 'This transaction has been removed from our system.',
    },
    {
      type: 'text',
      value:
        'If you have any questions about this action, please contact our support team.',
    },
  ];

  const isEmailSent = await Promise.all([
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: transaction.contractId.recruiterId.email,
      subject: 'EZY Jobs - Transaction Record Deleted',
      html: generateEmailTemplate({
        firstName: transaction.contractId.recruiterId.firstName,
        subject: 'EZY Jobs - Transaction Record Deleted',
        content: recruiterEmailContent,
      }),
    }),
    sendEmail(res, {
      from: process.env.NODEMAILER_SMTP_EMAIL,
      to: transaction.contractId.interviewerId.email,
      subject: 'EZY Jobs - Transaction Record Deleted',
      html: generateEmailTemplate({
        firstName: transaction.contractId.interviewerId.firstName,
        subject: 'EZY Jobs - Transaction Record Deleted',
        content: interviewerEmailContent,
      }),
    }),
  ]);

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Transaction deleted successfully but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Transaction deleted successfully',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc   Get transactions by contract
 *
 * @route  GET /api/transactions/contract/:contractId
 * @access Private
 * @role   Admin, Recruiter, Interviewer
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 *
 * @returns {Promise<void>}
 */

const getTransactionsByContract = asyncHandler(async (req, res) => {
  const contractId = req.params.contractId;

  if (!validateString(res, contractId)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Invalid contract ID. Please provide a valid identifier.');
  }

  const transactions = await Transaction.find({ contractId })
    .populate({
      path: 'contractId',
      populate: [
        {
          path: 'recruiterId',
          select: 'firstName lastName email'
        },
        {
          path: 'interviewerId',
          select: 'firstName lastName email'
        }
      ]
    });

  if (!transactions || transactions.length === 0) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'No transactions found for this contract. Please verify the details and try again.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `${transactions.length} transactions retrieved successfully`,
    count: transactions.length,
    transactions,
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getTransactionsByContract,
  updateTransactionById,
  deleteTransactionById,
};