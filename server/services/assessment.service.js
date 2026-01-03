const { PreAssessment, Application } = require('../models');
const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');
const crypto = require('crypto');

/**
 * @desc Generate sample assessment questions
 * @private
 */
const generateAssessmentQuestions = (jobCategory = 'general') => {
  // Sample questions - in production, these would come from a question bank or AI generation
  const baseQuestions = [
    {
      questionId: crypto.randomBytes(8).toString('hex'),
      type: 'mcq',
      question: 'What is the time complexity of binary search?',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      correctAnswer: 'O(log n)',
      points: 10,
    },
    {
      questionId: crypto.randomBytes(8).toString('hex'),
      type: 'mcq',
      question: 'Which data structure follows LIFO (Last In First Out) principle?',
      options: ['Queue', 'Stack', 'Array', 'Linked List'],
      correctAnswer: 'Stack',
      points: 10,
    },
    {
      questionId: crypto.randomBytes(8).toString('hex'),
      type: 'mcq',
      question: 'What is the purpose of version control systems like Git?',
      options: [
        'To compile code',
        'To track changes in code over time',
        'To deploy applications',
        'To write unit tests',
      ],
      correctAnswer: 'To track changes in code over time',
      points: 10,
    },
    {
      questionId: crypto.randomBytes(8).toString('hex'),
      type: 'coding',
      question: 'Write a function to reverse a string. Function signature: reverseString(str)',
      testCases: [
        { input: 'hello', expectedOutput: 'olleh' },
        { input: 'world', expectedOutput: 'dlrow' },
      ],
      points: 30,
    },
    {
      questionId: crypto.randomBytes(8).toString('hex'),
      type: 'coding',
      question: 'Write a function to find the maximum number in an array. Function signature: findMax(arr)',
      testCases: [
        { input: '[1, 5, 3, 9, 2]', expectedOutput: '9' },
        { input: '[-1, -5, -3]', expectedOutput: '-1' },
      ],
      points: 30,
    },
  ];

  return baseQuestions;
};

/**
 * @desc Create pre-assessment for a shortlisted application (called after shortlisting)
 */
const createAssessmentForApplication = async (applicationId, timeLimit = 60) => {
  try {
    const application = await Application.findById(applicationId)
      .populate('candidateId')
      .populate('jobId');

    if (!application) {
      throw new Error('Application not found.');
    }

    if (application.status !== 'shortlisted') {
      throw new Error('Assessment can only be created for shortlisted candidates.');
    }

    // Check if assessment already exists
    const existingAssessment = await PreAssessment.findOne({ applicationId });

    if (existingAssessment && existingAssessment.status !== 'expired') {
      console.log(`Assessment already exists for application ${applicationId}`);
      return existingAssessment;
    }

    // Generate questions
    const questions = generateAssessmentQuestions(application.jobId?.category);

    // Set expiration time (default 7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create assessment
    const assessment = await PreAssessment.create({
      applicationId: application._id,
      candidateId: application.candidateId._id,
      jobId: application.jobId._id,
      questions,
      timeLimit,
      expiresAt,
      status: 'pending',
      totalPoints: questions.reduce((sum, q) => sum + (q.points || 10), 0),
    });

    // Send email notification to candidate
    const assessmentLink = `${process.env.CLIENT_URL}/assessment/${assessment._id}`;
    
    try {
      await sendEmail(null, {
        from: process.env.NODEMAILER_SMTP_EMAIL,
        to: application.candidateId.email,
        subject: 'EZY Jobs - Pre-Assessment Invitation',
        html: generateEmailTemplate({
          firstName: application.candidateId.firstName,
          subject: 'Pre-Assessment Invitation',
          content: [
            {
              type: 'heading',
              value: 'Congratulations! You\'ve Been Shortlisted',
            },
            {
              type: 'text',
              value: `Your application for the position of <strong>${application.jobId.title}</strong> at ${application.jobId.company} has been shortlisted.`,
            },
            {
              type: 'heading',
              value: 'Next Step: Complete Your Pre-Assessment',
            },
            {
              type: 'text',
              value: 'To proceed with your application, please complete the pre-assessment test.',
            },
            {
              type: 'list',
              value: [
                `Time Limit: ${timeLimit} minutes`,
                `Attempts: Single attempt only`,
                `Assessment Link: <a href="${assessmentLink}">Click here to start</a>`,
              ],
            },
            {
              type: 'text',
              value: 'Please complete the assessment within 7 days. The link will expire after that period.',
            },
            {
              type: 'cta',
              value: {
                text: 'Start Assessment',
                link: assessmentLink,
              },
            },
            {
              type: 'text',
              value: '<strong>Important:</strong> Ensure you have a stable internet connection and webcam access before starting the assessment.',
            },
          ],
        }),
      });
      console.log(`✅ Assessment email sent to ${application.candidateId.email}`);
    } catch (emailError) {
      console.error('Failed to send assessment email:', emailError.message);
      // Don't throw - assessment is created even if email fails
    }

    return assessment;
  } catch (error) {
    console.error(`Error creating assessment for application ${applicationId}:`, error.message);
    throw error;
  }
};

module.exports = {
  createAssessmentForApplication,
};

