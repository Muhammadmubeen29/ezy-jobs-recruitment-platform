const emailValidator = require('email-validator');
const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const { User, Resume } = require('../models');

const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');

/**
 * @desc Verify user email with OTP.
 *
 * @route POST /api/v1/users/verify-email
 * @access Private
 *
 * @param {Object} req - The request object containing the OTP.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const verifyUserEmail = asyncHandler(async (req, res) => {
  const { otp, email } = req.body;

  if (!emailValidator.validate(email)) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Please enter a valid email address.');
  }

  // Support verification when JWT is expired or missing by allowing lookup by email
  let user;
  if (req.user && req.user.id) {
    // include otp and otpExpires for verification (do not exclude them here)
    user = await User.findById(req.user.id).select('-password');
  } else {
    // if there's no authenticated user (expired token), allow verification using email+otp
    user = await User.findOne({ email }).select('-password');
  }

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Unable to find your account. Please try again.');
  }

  if (user.email !== email) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('The email address does not match your account.');
  }

  if (user.isVerified) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'Your email is already verified. You can proceed to login.'
    );
  }

  // if (user.otp !== otp) {
  //   res.status(StatusCodes.BAD_REQUEST);
  //   throw new Error('Invalid verification code. Please check and try again.');
  // }
  if (String(user.otp).trim() !== String(otp).trim()) {
    res.status(StatusCodes.BAD_REQUEST);
    console.log('OTP from DB:', user.otp);
    console.log('OTP from request:', otp);
    throw new Error('Invalid verification code. Please check and try again.');
    
}



  if (user.otpExpires < new Date()) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Verification code has expired. Please request a new one.');
  }

  user.isVerified = true;

  const existingProfile = await Resume.findOne({ userId: user._id });

  if (!existingProfile) {
    await Resume.create({ userId: user._id });
  }

  await user.save();

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_USER,
    to: user.email,
    subject: 'Welcome to EZY Jobs - Email Verified',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'Welcome to EZY Jobs - Email Verified',
      content: [
        {
          type: 'heading',
          value: 'Email Verification Complete!',
        },
        {
          type: 'text',
          value:
            'Congratulations! Your email has been verified successfully. Your EZY Jobs account is now fully activated and ready to use.',
        },
        {
          type: 'heading',
          value: 'What You Can Do Now',
        },
        {
          type: 'list',
          value: [
            'Complete your professional profile to stand out',
            'Browse and apply for job opportunities',
            'Connect with recruiters and hiring managers',
            'Access AI-powered interview preparation tools',
          ],
        },
        {
          type: 'cta',
          value: {
            text: 'Complete Your Profile',
            link: `${process.env.CLIENT_URL}/profile`,
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
      'Unable to send confirmation email. Please try again later.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Your email has been verified successfully. Welcome to EZY Jobs!',
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      isLinkedinVerified: user.isLinkedinVerified,
      isAdmin: user.isAdmin,
      isRecruiter: user.isRecruiter,
      isInterviewer: user.isInterviewer,
      isCandidate: user.isCandidate,
      isTopRated: user.isTopRated,
      stripeAccountId: user.stripeAccountId,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc  Update Password
 *
 * @route PUT /api/v1/users/update-password
 * @access Private
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const updateUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Unable to find your account. Please try again.');
  }

  const { currentPassword, newPassword } = req.body;

  if (!(await user.validatePassword(currentPassword))) {
    res.status(StatusCodes.UNAUTHORIZED);
    throw new Error(
      'Current password is incorrect. Please check and try again.'
    );
  }

  if (currentPassword === newPassword) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error(
      'New password must be different from your current password.'
    );
  }

  user.password = newPassword;

  const updatedUser = await user.save();

  if (!updatedUser) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Password could not be updated. Please try again.');
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Password Updated',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Password Updated',
      content: [
        {
          type: 'heading',
          value: 'Password Updated Successfully',
        },
        {
          type: 'text',
          value:
            'Your EZY Jobs account password has been changed. This change will take effect immediately.',
        },
        {
          type: 'list',
          value: [
            'Log in using your new password',
            'Update your password manager (if you use one)',
            "Don't share your password with others",
          ],
        },
        {
          type: 'text',
          value:
            'If you did not request this password change, please contact our support team immediately.',
        },
        {
          type: 'cta',
          value: {
            text: 'Go to Login Page',
            link: `${process.env.CLIENT_URL}/login`,
          },
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Password updated but notification email could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message:
      'Password updated successfully. You can now login with your new password.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Gets the User Profile.
 *
 * @route GET /api/v1/users/profile
 * @access Private
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -otp -otpExpires');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Unable to locate your profile. Please try again or contact support.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile retrieved successfully.',
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      isLinkedinVerified: user.isLinkedinVerified,
      isAdmin: user.isAdmin,
      isRecruiter: user.isRecruiter,
      isInterviewer: user.isInterviewer,
      isCandidate: user.isCandidate,
      isTopRated: user.isTopRated,
      stripeAccountId: user.stripeAccountId,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Updates the User Profile.
 *
 * @route PUT /api/v1/users/profile
 * @access Private
 *
 * @param {Object} req - The request object containing updated user details.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -otp -otpExpires');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Unable to find your profile. Please refresh and try again.'
    );
  }

  const { firstName, lastName, email, phone } = req.body;

  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  user.phone = phone || user.phone;

  if (email) {
    if (!emailValidator.validate(email)) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Please enter a valid email address format.');
    }
    user.email = email;
  }

  const updatedUser = await user.save();

  if (!updatedUser) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Profile could not be updated. Please try again.');
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Profile Updated Successfully',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Profile Updated Successfully',
      content: [
        {
          type: 'heading',
          value: 'Profile Update Confirmation',
        },
        {
          type: 'text',
          value:
            'Your EZY Jobs profile has been successfully updated with the following information:',
        },
        {
          type: 'list',
          value: [
            `Name: ${user.firstName} ${user.lastName}`,
            `Email: ${user.email}`,
            `Phone: ${user.phone || 'Not provided'}`,
          ],
        },
        {
          type: 'heading',
          value: 'Security Recommendation',
        },
        {
          type: 'text',
          value:
            'If you did not make these changes, please secure your account immediately by:',
        },
        {
          type: 'list',
          value: [
            'Changing your password',
            'Reviewing your recent account activity',
            'Contacting our support team',
          ],
        },
        {
          type: 'cta',
          value: {
            text: 'View Your Profile',
            link: `${process.env.CLIENT_URL}/profile`,
          },
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Profile updated but notification email could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Your profile has been updated successfully.',
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      isLinkedinVerified: user.isLinkedinVerified,
      isAdmin: user.isAdmin,
      isRecruiter: user.isRecruiter,
      isInterviewer: user.isInterviewer,
      isCandidate: user.isCandidate,
      isTopRated: user.isTopRated,
    },
  });
});

/**
 * @desc Deletes the user profile.
 *
 * @route DELETE /api/v1/users/profile
 * @access Private
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const deleteUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('We could not find your profile. Please try again.');
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Account Deletion Confirmation',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Account Deletion Confirmation',
      content: [
        {
          type: 'heading',
          value: 'Account Deletion Confirmation',
        },
        {
          type: 'text',
          value:
            'We have successfully processed your account deletion request. Your EZY Jobs account and associated data have been removed from our system.',
        },
        {
          type: 'heading',
          value: 'Important Information',
        },
        {
          type: 'text',
          value:
            'If you did not request this account deletion, please take the following steps immediately:',
        },
        {
          type: 'list',
          value: [
            'Contact our support team as soon as possible',
            'Report any suspicious activity on your email account',
            'Consider changing passwords for other accounts that used the same email',
          ],
        },
        {
          type: 'text',
          value:
            'We value your privacy and data security. Thank you for being part of EZY Jobs.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Account deleted but notification email could not be delivered.'
    );
  }

  await User.findByIdAndDelete(req.user.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Your account has been successfully deleted.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Gets all users.
 *
 * @route GET /api/v1/users
 * @access Private AND Admin
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getAllUsersProfile = asyncHandler(async (req, res) => {
  const { role, email, firstName, lastName } = req.query;
  let query = {};

  const isAdminRequest = req.user && req.user.isAdmin;

  if (role) {
    switch (role.toLowerCase()) {
      case 'admin':
        query.isAdmin = true;
        break;
      case 'recruiter':
        query.isRecruiter = true;
        break;
      case 'interviewer':
        query.isInterviewer = true;
        break;
      case 'candidate':
        query.isCandidate = true;
        break;
      default:
        res.status(StatusCodes.BAD_REQUEST);
        throw new Error('Invalid user role. Please select a valid role.');
    }
  } else if (isAdminRequest) {
    query.isAdmin = false;
  }

  if (email) {
    query.email = { $regex: email, $options: 'i' };
  }

  if (firstName) {
    query.firstName = { $regex: firstName, $options: 'i' };
  }

  if (lastName) {
    query.lastName = { $regex: lastName, $options: 'i' };
  }

  const users = await User.find(query)
    .select('-password -otp -otpExpires')
    .sort({ createdAt: -1 });

  if (!users.length) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('No users found. Try adjusting your search criteria.');
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Found ${users.length} user${users.length === 1 ? '' : 's'
      } matching your search.`,
    count: users.length,
    users: users,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Gets a user by ID.
 *
 * @route GET /api/v1/users/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const getUserProfileById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -otp -otpExpires');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'This user profile could not be found. Please verify the user ID and try again.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User profile retrieved successfully.',
    user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Updates a user by ID.
 *
 * @route PUT /api/v1/users/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object containing updated user details.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const updateUserProfileById = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, role, isVerified, isTopRated } =
    req.body;

  const user = await User.findById(req.params.id).select('-password -otp -otpExpires');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'User profile not found. Please check the ID and try again.'
    );
  }

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;

  if (email && email !== user.email) {
    if (!emailValidator.validate(email)) {
      res.status(StatusCodes.BAD_REQUEST);
      throw new Error('Please enter a valid email address format.');
    }
    user.email = email;
  }

  if (isVerified !== undefined) {
    user.isVerified = Boolean(isVerified);
  }

  if (isTopRated !== undefined) {
    user.isTopRated = Boolean(isTopRated);
  }

  if (role) {
    user.isAdmin = false;
    user.isRecruiter = false;
    user.isInterviewer = false;
    user.isCandidate = false;

    switch (role.toLowerCase()) {
      case 'admin':
        user.isAdmin = true;
        break;
      case 'recruiter':
        user.isRecruiter = true;
        break;
      case 'interviewer':
        user.isInterviewer = true;
        break;
      case 'candidate':
        user.isCandidate = true;
        break;
      default:
        res.status(StatusCodes.BAD_REQUEST);
        throw new Error(
          'Invalid role specified. Valid roles are: admin, recruiter, interviewer, candidate'
        );
    }
  }

  const updatedUser = await user.save();

  if (!updatedUser) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('User profile could not be updated. Please try again.');
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Your Profile Has Been Updated',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Profile Update Notification',
      content: [
        {
          type: 'heading',
          value: 'Your EZY Jobs Profile Has Been Updated',
        },
        {
          type: 'text',
          value:
            'An administrator has made changes to your EZY Jobs account. Your profile information has been updated in our system.',
        },
        {
          type: 'heading',
          value: 'Updated Information',
        },
        {
          type: 'list',
          value: [
            `Name: ${user.firstName} ${user.lastName}`,
            `Email: ${user.email}`,
            `Phone: ${user.phone || 'Not provided'}`,
            `Account Role: ${user.isAdmin
              ? 'Administrator'
              : user.isRecruiter
                ? 'Recruiter'
                : user.isInterviewer
                  ? 'Interviewer'
                  : 'Candidate'
            }`,
            `Verification Status: ${user.isVerified ? 'Verified' : 'Not Verified'
            }`,
          ],
        },
        {
          type: 'heading',
          value: 'Important Note',
        },
        {
          type: 'text',
          value:
            'If you did not expect these changes or have any questions, please contact our support team immediately for assistance.',
        },
        {
          type: 'cta',
          value: {
            text: 'View Your Profile',
            link: `${process.env.CLIENT_URL}/profile`,
          },
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Profile updated but notification email could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User profile has been updated successfully.',
    user: {
      id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      isVerified: updatedUser.isVerified,
      isLinkedinVerified: updatedUser.isLinkedinVerified,
      isAdmin: updatedUser.isAdmin,
      isRecruiter: updatedUser.isRecruiter,
      isInterviewer: updatedUser.isInterviewer,
      isCandidate: updatedUser.isCandidate,
      isTopRated: updatedUser.isTopRated,
      stripeAccountId: updatedUser.stripeAccountId,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Deletes a user by ID.
 *
 * @route DELETE /api/v1/users/:id
 * @access Private (Admin)
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const deleteUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -otp -otpExpires');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error(
      'Unable to locate user account. Please verify and try again.'
    );
  }

  const isDestroyed = await User.findByIdAndDelete(req.params.id);

  if (!isDestroyed) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Account deletion failed. Please try again or contact support.'
    );
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Account Deactivated',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Account Deactivated',
      content: [
        {
          type: 'heading',
          value: 'Account Deactivation Notice',
        },
        {
          type: 'text',
          value:
            'Your EZY Jobs account has been deactivated by an administrator. This means your profile is no longer accessible on our platform.',
        },
        {
          type: 'heading',
          value: 'What This Means',
        },
        {
          type: 'list',
          value: [
            'Your profile is no longer visible to recruiters or employers',
            'You cannot apply for jobs or access platform features',
            'Your data remains stored in our system for potential reactivation',
            'You can request account restoration by contacting support',
          ],
        },
        {
          type: 'text',
          value:
            'If you believe this action was taken in error or would like to discuss reactivating your account, please contact our support team.',
        },
        {
          type: 'cta',
          value: {
            text: 'Contact Support',
            link: `${process.env.CLIENT_URL}/contact`,
          },
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(
      'Account deactivated but notification emails could not be delivered.'
    );
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Account successfully deactivated.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Deletes a user permanently by ID.
 *
 * @route DELETE /api/v1/users/:id/permanent
 * @access Private (Admin)
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 *
 * @returns {Promise<void>}
 */

const deleteUserPermById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('The requested user account could not be found.');
  }

  const isDestroyed = await User.findByIdAndDelete(req.params.id);

  if (!isDestroyed) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Unable to process deletion request. Please try again.');
  }

  const isEmailSent = await sendEmail(res, {
    from: process.env.NODEMAILER_SMTP_EMAIL,
    to: user.email,
    subject: 'EZY Jobs - Account Permanently Deleted',
    html: generateEmailTemplate({
      firstName: user.firstName,
      subject: 'EZY Jobs - Account Permanently Deleted',
      content: [
        {
          type: 'heading',
          value: 'Account Permanently Deleted',
        },
        {
          type: 'text',
          value:
            'Your EZY Jobs account has been permanently deleted from our system. This action cannot be undone, and all associated data has been removed from our database.',
        },
        {
          type: 'heading',
          value: 'What Was Deleted',
        },
        {
          type: 'list',
          value: [
            'Account profile and personal information',
            'Application history and submitted documents',
            'Messages and communication records',
            'All saved preferences and settings',
          ],
        },
        {
          type: 'heading',
          value: 'Important Notice',
        },
        {
          type: 'text',
          value:
            'If you did not request this permanent deletion or believe this action was taken in error, please contact our support team immediately.',
        },
        {
          type: 'cta',
          value: {
            text: 'Contact Support',
            link: `${process.env.CLIENT_URL}/contact`,
          },
        },
        {
          type: 'text',
          value:
            'If you wish to use EZY Jobs services in the future, you will need to create a new account with a new email address.',
        },
      ],
    }),
  });

  if (!isEmailSent) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error('Account deleted but unable to send confirmation email.');
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Account and associated data permanently deleted.',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  verifyUserEmail,
  updateUserPassword,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
  getAllUsersProfile,
  getUserProfileById,
  updateUserProfileById,
  deleteUserById,
  deleteUserPermById,
};