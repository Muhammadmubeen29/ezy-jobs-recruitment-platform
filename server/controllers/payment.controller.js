const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');
const cron = require('node-cron');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
// Removed Sequelize import - using Mongoose now

const { User, Contract, Transaction, Job } = require('../models');
const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');

const PLATFORM_FEE_PERCENTAGE = 0.025; // 2.5%

/**
 * Helper function to add business days (excludes weekends)
 */
const addBusinessDays = (date, days) => {
  const result = new Date(date);
  let count = 0;

  while (count < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      count++;
    }
  }

  return result;
};

/**
 * Helper function to check if payout is scheduled for a contract
 */
const isPayoutScheduled = async (contractId) => {
  const scheduledTransaction = await Transaction.findOne({
    contractId: contractId,
    transactionType: 'payout',
    status: 'pending', // We'll use 'pending' for scheduled payouts
  });
  return scheduledTransaction;
};

/**
 * Process scheduled payouts (called by cron job)
 */
const processScheduledPayouts = async () => {
  try {
    const now = new Date();

    // Find all scheduled payouts that are due
    const duePayouts = await Transaction.find({
      status: 'pending',
      transactionType: 'payout',
      transactionDate: { $lte: now },
    }).populate({
      path: 'contractId',
      populate: [
        { path: 'recruiterId', model: 'User' },
        { path: 'interviewerId', model: 'User' },
      ],
    });

    console.log(`Found ${duePayouts.length} payouts to process`);

    for (const transaction of duePayouts) {
      try {
        // Update transaction status to completed
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: 'completed',
          transactionDate: new Date(),
        });

        // Send payout completion emails
        await Promise.all([
          // Email to recruiter
          sendEmail(res, {
            from: process.env.NODEMAILER_SMTP_EMAIL,
            to: transaction.contractId.recruiterId.email,
            subject: 'EZY Jobs - Scheduled Payout Processed',
            html: generateEmailTemplate({
              firstName: transaction.contractId.recruiterId.firstName,
              subject: 'Scheduled Payout Processed',
              content: [
                {
                  type: 'heading',
                  value: 'Payout Processed!',
                },
                {
                  type: 'text',
                  value: `The scheduled payout for your contract has been processed. $${transaction.netAmount} has been transferred to the interviewer.`,
                },
              ],
            }),
          }),
          // Email to interviewer
          sendEmail(res, {
            from: process.env.NODEMAILER_SMTP_EMAIL,
            to: transaction.contractId.interviewerId.email,
            subject: 'EZY Jobs - Payment Released',
            html: generateEmailTemplate({
              firstName: transaction.contractId.interviewerId.firstName,
              subject: 'Scheduled Payment Released',
              content: [
                {
                  type: 'heading',
                  value: 'Payment Released!',
                },
                {
                  type: 'text',
                  value: `Your scheduled payment of $${transaction.netAmount} has been transferred to your Stripe account.`,
                },
                {
                  type: 'text',
                  value:
                    'The funds should appear in your bank account within 2-7 business days.',
                },
              ],
            }),
          }),
        ]);

        console.log(
          `✅ Processed scheduled payout for contract ${transaction.contractId._id}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process payout for transaction ${transaction._id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error('Error processing scheduled payouts:', error);
  }
};

// Set up cron job to run every hour to check for due payouts
cron.schedule('0 * * * *', () => {
  console.log('🔄 Checking for scheduled payouts...');
  processScheduledPayouts();
});

/**
 * @desc Create Stripe Connect account for interviewer
 *
 * @route POST /api/v1/payments/connect/onboard
 * @access Private (Interviewer)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const createStripeConnectAccount = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.isInterviewer) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('Only interviewers can create Stripe Connect accounts.');
  }

  if (user.stripeAccountId) {
    res.status(StatusCodes.CONFLICT);
    throw new Error('Stripe Connect account already exists for this user.');
  }

  try {
    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
      },
    });

    // Update user with Stripe account ID
    await User.findByIdAndUpdate(user._id, {
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/interviewer/stripe/refresh`,
      return_url: `${process.env.CLIENT_URL}/interviewer/stripe/return`,
      type: 'account_onboarding',
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Stripe Connect account created successfully.',
      data: {
        accountId: account.id,
        onboardingUrl: accountLink.url,
        accountStatus: 'pending',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Stripe Connect account creation failed: ${error.message}`);
  }
});

/**
 * @desc Get Stripe Connect account status
 *
 * @route GET /api/v1/payments/connect/status
 * @access Private (Interviewer)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const getStripeConnectStatus = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.isInterviewer) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('Only interviewers can check Stripe Connect status.');
  }

  if (!user.stripeAccountId) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'No Stripe Connect account found.',
      data: {
        hasAccount: false,
        accountStatus: null,
        payoutEnabled: false,
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(user.stripeAccountId);

    let accountStatus = 'pending';
    const payoutEnabled = account.payouts_enabled;
    const chargesEnabled = account.charges_enabled;

    if (payoutEnabled && chargesEnabled) {
      accountStatus = 'verified';
    } else if (account.requirements.currently_due.length > 0) {
      accountStatus = 'restricted';
    }

    // Update user status in database
    await User.findByIdAndUpdate(user._id, {
      stripeAccountStatus: accountStatus,
      payoutEnabled: payoutEnabled,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Stripe Connect status retrieved successfully.',
      data: {
        hasAccount: true,
        accountId: user.stripeAccountId,
        accountStatus: accountStatus,
        payoutEnabled: payoutEnabled,
        chargesEnabled: chargesEnabled,
        requirementsDue: account.requirements.currently_due,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      `Failed to retrieve Stripe Connect status: ${error.message}`
    );
  }
});

/**
 * @desc Create account link for re-onboarding
 *
 * @route POST /api/v1/payments/connect/refresh
 * @access Private (Interviewer)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const refreshStripeConnectLink = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.isInterviewer || !user.stripeAccountId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Invalid Stripe Connect account.');
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${process.env.CLIENT_URL}/interviewer/stripe/refresh`,
      return_url: `${process.env.CLIENT_URL}/interviewer/stripe/return`,
      type: 'account_onboarding',
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Stripe Connect onboarding link refreshed.',
      data: {
        onboardingUrl: accountLink.url,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to refresh onboarding link: ${error.message}`);
  }
});

/**
 * @desc Get Stripe Connect dashboard link
 *
 * @route GET /api/v1/payments/connect/dashboard
 * @access Private (Interviewer)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const getStripeConnectDashboard = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.isInterviewer || !user.stripeAccountId) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Invalid Stripe Connect account.');
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(
      user.stripeAccountId
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Stripe Connect dashboard link generated.',
      data: {
        dashboardUrl: loginLink.url,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate dashboard link: ${error.message}`);
  }
});

/**
 * @desc Create payment intent for contract
 *
 * @route POST /api/v1/payments/contracts/:contractId/pay
 * @access Private (Recruiter)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const createContractPayment = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const user = req.user;

  if (!user.isRecruiter) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('Only recruiters can make contract payments.');
  }

  // Get contract with related data
  const contract = await Contract.findById(contractId)
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email stripeAccountId payoutEnabled')
    .populate('jobId', 'title');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found.');
  }

  if (contract.recruiterId.toString() !== user._id.toString()) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You can only pay for your own contracts.');
  }

  if (contract.paymentStatus === 'paid') {
    res.status(StatusCodes.CONFLICT);
    throw new Error('Contract has already been paid.');
  }

  if (
    !contract.interviewerId.stripeAccountId ||
    !contract.interviewerId.payoutEnabled
  ) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Interviewer has not completed Stripe Connect setup.');
  }

  try {
    // Calculate platform fee
    const amount = Math.round(contract.agreedPrice * 100); // Convert to cents
    const applicationFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE);

    // Create customer if doesn't exist
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
          userType: 'recruiter',
        },
      });
      customerId = customer.id;

      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customerId,
      });
    }

    // Create PaymentIntent with application fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      customer: customerId,
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: contract.interviewerId.stripeAccountId,
      },
      metadata: {
        contractId: contractId,
        recruiterId: user._id,
        interviewerId: contract.interviewerId._id,
        jobId: contract.jobId._id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update contract with payment intent
    await Contract.findByIdAndUpdate(contractId, {
      paymentIntentId: paymentIntent.id,
      stripeApplicationFee: applicationFee / 100, // Store in dollars
    });

    // Create transaction record
    await Transaction.create({
      amount: contract.agreedPrice,
      status: 'pending',
      transactionDate: new Date(),
      transactionType: 'payment',
      contractId: contractId,
      stripePaymentIntentId: paymentIntent.id,
      platformFee: applicationFee / 100,
      netAmount: (amount - applicationFee) / 100,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Payment intent created successfully.',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: contract.agreedPrice,
        platformFee: applicationFee / 100,
        netAmount: (amount - applicationFee) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
});

/**
 * @desc Confirm contract payment
 *
 * @route POST /api/v1/payments/contracts/:contractId/confirm
 * @access Private (Recruiter)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const confirmContractPayment = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const { paymentIntentId } = req.body;
  const user = req.user;

  const contract = await Contract.findById(contractId)
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email');

  if (!contract || contract.recruiterId.toString() !== user._id.toString()) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found or unauthorized.');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update contract status
      await Contract.findByIdAndUpdate(contractId, {
        paymentStatus: 'paid',
        status: 'active',
      });

      // Update transaction status
      await Transaction.findOneAndUpdate(
        {
          contractId: contractId,
          stripePaymentIntentId: paymentIntentId,
        },
        { status: 'completed' }
      );

      // Send confirmation emails
      await Promise.all([
        // Email to recruiter
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.recruiterId.email,
          subject: 'EZY Jobs - Payment Confirmed',
          html: generateEmailTemplate({
            firstName: contract.recruiterId.firstName,
            subject: 'Payment Confirmed - Contract Active',
            content: [
              {
                type: 'heading',
                value: 'Payment Confirmed!',
              },
              {
                type: 'text',
                value: `Your payment of $${contract.agreedPrice} for the interview contract has been confirmed. The funds are now held securely and will be released to the interviewer upon contract completion.`,
              },
              {
                type: 'text',
                value: `Contract ID: ${contractId}`,
              },
            ],
          }),
        }),
        // Email to interviewer
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.interviewerId.email,
          subject: 'EZY Jobs - Contract Payment Received',
          html: generateEmailTemplate({
            firstName: contract.interviewerId.firstName,
            subject: 'Contract Payment Received',
            content: [
              {
                type: 'heading',
                value: 'Contract Payment Received!',
              },
              {
                type: 'text',
                value: `The recruiter has paid $${contract.agreedPrice} for your interview services. The funds are held securely and will be transferred to your account upon contract completion.`,
              },
              {
                type: 'text',
                value: `After our 2.5% platform fee, you will receive $${(contract.agreedPrice * (1 - PLATFORM_FEE_PERCENTAGE)).toFixed(2)}.`,
              },
            ],
          }),
        }),
      ]);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Payment confirmed successfully.',
        data: {
          contractId: contractId,
          paymentStatus: 'paid',
          contractStatus: 'active',
          amount: contract.agreedPrice,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Payment not completed successfully.');
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Payment confirmation failed: ${error.message}`);
  }
});

/**
 * @desc Complete contract and trigger payout
 *
 * @route POST /api/v1/payments/contracts/:contractId/complete
 * @access Private (Interviewer, Recruiter, Admin)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const completeContractAndPayout = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const user = req.user;

  const contract = await Contract.findById(contractId)
    .populate('recruiterId', 'firstName lastName email')
    .populate('interviewerId', 'firstName lastName email')
    .populate('jobId', 'title');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found.');
  }

  // Check authorization
  if (
    !user.isAdmin &&
    contract.recruiterId.toString() !== user._id.toString() &&
    contract.interviewerId.toString() !== user._id.toString()
  ) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You are not authorized to complete this contract.');
  }

  if (contract.status === 'completed') {
    res.status(StatusCodes.CONFLICT);
    throw new Error('Contract is already completed.');
  }

  if (contract.paymentStatus !== 'paid') {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Contract must be paid before completion.');
  }

  try {
    // RECRUITER COMPLETION: Schedule automatic payout after 2 business days
    if (user.isRecruiter && contract.recruiterId.toString() === user._id.toString()) {
      // Update contract status to completed
      await Contract.findByIdAndUpdate(contractId, {
        status: 'completed',
      });

      // Calculate payout date (2 business days from now)
      const payoutDate = addBusinessDays(new Date(), 2);
      const netAmount = contract.agreedPrice * (1 - PLATFORM_FEE_PERCENTAGE);

      // Create scheduled payout transaction
      await Transaction.create({
        amount: netAmount,
        status: 'pending', // Use 'pending' for scheduled payouts
        transactionDate: payoutDate,
        transactionType: 'payout',
        contractId: contractId,
        platformFee: contract.stripeApplicationFee,
        netAmount: netAmount,
      });

      // Send emails about completion and scheduled payout
      await Promise.all([
        // Email to recruiter
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.recruiterId.email,
          subject: 'EZY Jobs - Contract Completed',
          html: generateEmailTemplate({
            firstName: contract.recruiterId.firstName,
            subject: 'Contract Completed Successfully',
            content: [
              {
                type: 'heading',
                value: 'Contract Marked as Completed!',
              },
              {
                type: 'text',
                value: `You have successfully marked the contract for "${contract.jobId.title}" as completed. The interviewer payment has been scheduled for automatic processing.`,
              },
              {
                type: 'text',
                value: `Payout will be processed on: ${payoutDate.toLocaleDateString()}`,
              },
              {
                type: 'text',
                value: `Net amount to be transferred: $${netAmount.toFixed(2)} (after 2.5% platform fee)`,
              },
            ],
          }),
        }),
        // Email to interviewer
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.interviewerId.email,
          subject: 'EZY Jobs - Contract Completed - Payment Scheduled',
          html: generateEmailTemplate({
            firstName: contract.interviewerId.firstName,
            subject: 'Contract Completed - Payment Scheduled',
            content: [
              {
                type: 'heading',
                value: 'Great News! Contract Completed!',
              },
              {
                type: 'text',
                value: `The recruiter has marked your contract for "${contract.jobId.title}" as completed. Your payment of $${netAmount.toFixed(2)} has been scheduled for automatic processing.`,
              },
              {
                type: 'text',
                value: `Payment will be transferred to your account on: ${payoutDate.toLocaleDateString()}`,
              },
              {
                type: 'text',
                value:
                  'The funds should appear in your bank account within 2-7 business days after processing.',
              },
            ],
          }),
        }),
      ]);

      res.status(StatusCodes.OK).json({
        success: true,
        message:
          'Contract completed successfully. Payout has been scheduled for automatic processing.',
        data: {
          contractId: contractId,
          status: 'completed',
          payoutAmount: netAmount,
          payoutScheduledFor: payoutDate,
          platformFee: contract.stripeApplicationFee,
          automatedPayout: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
    // INTERVIEWER COMPLETION: Only allow if no scheduled payout exists
    else if (user.isInterviewer && contract.interviewerId.toString() === user._id.toString()) {
      const scheduledPayout = await isPayoutScheduled(contractId);
      if (scheduledPayout) {
        res.status(StatusCodes.CONFLICT);
        throw new Error(
          'Contract completion is scheduled for automatic processing by the recruiter. Manual completion is disabled. Your payment will be processed automatically on the scheduled date.'
        );
      }

      // Process immediate payout (fallback for when automation fails)
      await Contract.findByIdAndUpdate(contractId, {
        status: 'completed',
      });

      const netAmount = contract.agreedPrice * (1 - PLATFORM_FEE_PERCENTAGE);

      await Transaction.create({
        amount: netAmount,
        status: 'completed',
        transactionDate: new Date(),
        transactionType: 'payout',
        contractId: contractId,
        platformFee: contract.stripeApplicationFee,
        netAmount: netAmount,
      });

      // Send completion emails
      await Promise.all([
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.recruiterId.email,
          subject: 'EZY Jobs - Contract Completed by Interviewer',
          html: generateEmailTemplate({
            firstName: contract.recruiterId.firstName,
            subject: 'Contract Completed by Interviewer',
            content: [
              {
                type: 'heading',
                value: 'Contract Completed!',
              },
              {
                type: 'text',
                value: `The interviewer has manually completed the contract for "${contract.jobId.title}". Payment has been processed immediately.`,
              },
            ],
          }),
        }),
        sendEmail(res, {
          from: process.env.NODEMAILER_SMTP_EMAIL,
          to: contract.interviewerId.email,
          subject: 'EZY Jobs - Payment Released',
          html: generateEmailTemplate({
            firstName: contract.interviewerId.firstName,
            subject: 'Payment Released to Your Account',
            content: [
              {
                type: 'heading',
                value: 'Payment Released!',
              },
              {
                type: 'text',
                value: `You have successfully completed the contract and $${netAmount.toFixed(2)} has been transferred to your Stripe account.`,
              },
              {
                type: 'text',
                value:
                  'The funds should appear in your bank account within 2-7 business days.',
              },
            ],
          }),
        }),
      ]);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Contract completed and payout processed immediately.',
        data: {
          contractId: contractId,
          status: 'completed',
          payoutAmount: netAmount,
          platformFee: contract.stripeApplicationFee,
          automatedPayout: false,
        },
        timestamp: new Date().toISOString(),
      });
    }
    // ADMIN COMPLETION: Allow both immediate and scheduled based on request
    else if (user.isAdmin) {
      const { forceImmediate } = req.body;

      if (forceImmediate) {
        // Process immediate payout
        await Contract.findByIdAndUpdate(contractId, {
          status: 'completed',
        });

        const netAmount = contract.agreedPrice * (1 - PLATFORM_FEE_PERCENTAGE);

        await Transaction.create({
          amount: netAmount,
          status: 'completed',
          transactionDate: new Date(),
          transactionType: 'payout',
          contractId: contractId,
          platformFee: contract.stripeApplicationFee,
          netAmount: netAmount,
        });

        res.status(StatusCodes.OK).json({
          success: true,
          message: 'Contract completed by admin with immediate payout.',
          data: {
            contractId: contractId,
            status: 'completed',
            payoutAmount: netAmount,
            platformFee: contract.stripeApplicationFee,
            automatedPayout: false,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Default admin behavior: schedule payout
        await Contract.findByIdAndUpdate(contractId, {
          status: 'completed',
        });

        const payoutDate = addBusinessDays(new Date(), 2);
        const netAmount = contract.agreedPrice * (1 - PLATFORM_FEE_PERCENTAGE);

        await Transaction.create({
          amount: netAmount,
          status: 'pending',
          transactionDate: payoutDate,
          transactionType: 'payout',
          contractId: contractId,
          platformFee: contract.stripeApplicationFee,
          netAmount: netAmount,
        });

        res.status(StatusCodes.OK).json({
          success: true,
          message: 'Contract completed by admin with scheduled payout.',
          data: {
            contractId: contractId,
            status: 'completed',
            payoutAmount: netAmount,
            payoutScheduledFor: payoutDate,
            platformFee: contract.stripeApplicationFee,
            automatedPayout: true,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      res.status(StatusCodes.FORBIDDEN);
      throw new Error('Invalid user role for completing contracts.');
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Contract completion failed: ${error.message}`);
  }
});

/**
 * @desc Get payment status for contract
 *
 * @route GET /api/v1/payments/contracts/:contractId/status
 * @access Private
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const getContractPaymentStatus = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const user = req.user;

  const contract = await Contract.findById(contractId)
    .populate('transactions');

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found.');
  }

  // Check authorization
  if (
    !user.isAdmin &&
    contract.recruiterId !== user.id &&
    contract.interviewerId !== user.id
  ) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You are not authorized to view this contract.');
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Contract payment status retrieved successfully.',
    data: {
      contractId: contractId,
      agreedPrice: contract.agreedPrice,
      paymentStatus: contract.paymentStatus,
      contractStatus: contract.status,
      platformFee: contract.stripeApplicationFee,
      transactions: contract.transactions,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get contract payout status (for frontend to check if payout is scheduled)
 *
 * @route GET /api/v1/payments/contracts/:contractId/payout-status
 * @access Private (Recruiter, Interviewer, Admin)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const getContractPayoutStatus = asyncHandler(async (req, res) => {
  const { contractId } = req.params;
  const user = req.user;

  const contract = await Contract.findById(contractId);

  if (!contract) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Contract not found.');
  }

  // Check authorization
  if (
    !user.isAdmin &&
    contract.recruiterId !== user.id &&
    contract.interviewerId !== user.id
  ) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error('You are not authorized to view this contract.');
  }

  // Check for scheduled payout
  const scheduledPayout = await Transaction.findOne({
    contractId: contractId,
    transactionType: 'payout',
    status: 'pending',
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Contract payout status retrieved successfully.',
    data: {
      contractId: contractId,
      hasScheduledPayout: !!scheduledPayout,
      scheduledPayoutDate: scheduledPayout?.transactionDate || null,
      scheduledAmount: scheduledPayout?.netAmount || null,
      contractStatus: contract.status,
      paymentStatus: contract.paymentStatus,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get payout history for interviewer
 *
 * @route GET /api/v1/payments/payouts
 * @access Private (Interviewer)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const getPayoutHistory = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.isInterviewer) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('Only interviewers can view payout history.');
  }

  const payouts = await Transaction.find({
    transactionType: 'payout',
  })
    .populate({
      path: 'contractId',
      match: { interviewerId: user._id },
      populate: [
        { path: 'jobId', select: 'title' },
        { path: 'recruiterId', select: 'firstName lastName email' },
      ],
    })
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Payout history retrieved successfully.',
    data: {
      payouts: payouts,
      totalEarnings: payouts.reduce(
        (sum, payout) => sum + parseFloat(payout.netAmount || 0),
        0
      ),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Handle Stripe webhooks
 *
 * @route POST /api/v1/payments/webhooks/stripe
 * @access Public (Stripe)
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      break;

    case 'account.updated':
      const account = event.data.object;
      // Update user's Stripe account status
      await User.findOneAndUpdate(
        { stripeAccountId: account.id },
        {
          stripeAccountStatus: account.payouts_enabled ? 'verified' : 'pending',
          payoutEnabled: account.payouts_enabled,
        }
      );
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      // Update transaction status to failed
      await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: failedPayment.id },
        { status: 'failed' }
      );
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = {
  createStripeConnectAccount,
  getStripeConnectStatus,
  refreshStripeConnectLink,
  getStripeConnectDashboard,
  createContractPayment,
  confirmContractPayment,
  completeContractAndPayout,
  getContractPaymentStatus,
  getContractPayoutStatus,
  getPayoutHistory,
  handleStripeWebhook,
  processScheduledPayouts,
};
