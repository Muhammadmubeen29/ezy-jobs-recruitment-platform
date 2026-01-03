const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');

const { PreAssessment, Application, User, Job } = require('../models');
const {
  sendEmail,
  generateEmailTemplate,
} = require('../utils/nodemailer.utils');

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
 * @desc Check plagiarism for coding answers
 * @private
 */
const checkPlagiarism = async (answer, questionId) => {
  // Simplified plagiarism checker - in production, use services like MOSS, JPlag, or Copyleaks API
  // For now, we'll use a basic similarity check based on common patterns
  
  if (!answer || answer.trim().length === 0) {
    return { similarityScore: 0, flagged: false };
  }

  // Normalize the answer
  const normalizedAnswer = answer
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();

  // Check for suspicious patterns (this is a simplified version)
  // In production, you would compare against a database of previous submissions
  const suspiciousPatterns = [
    /function\s*\w+\s*\([^)]*\)\s*\{[\s\S]*return[\s\S]*\}/gi,
  ];

  let similarityScore = 0;
  
  // Basic heuristic: longer answers are less likely to be copied verbatim
  // Very short or very long answers might be suspicious
  if (normalizedAnswer.length < 20) {
    similarityScore = 30; // Suspiciously short
  } else if (normalizedAnswer.length > 500) {
    similarityScore = 25; // Suspiciously long
  } else {
    similarityScore = Math.floor(Math.random() * 20); // Random for demo (0-20%)
  }

  // In production, this would:
  // 1. Compare against all previous submissions
  // 2. Use n-gram analysis
  // 3. Use semantic similarity (embedding-based)
  // 4. Check against code repositories

  return {
    similarityScore: Math.min(100, Math.max(0, similarityScore)),
    flagged: similarityScore > 40,
  };
};

/**
 * @desc Create a pre-assessment session for a shortlisted candidate
 * @route POST /api/v1/pre-assessments
 * @access Private (System/Admin)
 */
const createPreAssessment = asyncHandler(async (req, res) => {
  const { applicationId, timeLimit = 60 } = req.body;

  const application = await Application.findById(applicationId)
    .populate('candidateId')
    .populate('jobId');

  if (!application) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Application not found.');
  }

  if (application.status !== 'shortlisted') {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment can only be created for shortlisted candidates.');
  }

  // Check if assessment already exists
  const existingAssessment = await PreAssessment.findOne({ applicationId });

  if (existingAssessment && existingAssessment.status !== 'expired') {
    res.status(StatusCodes.CONFLICT);
    throw new Error('An active assessment already exists for this application.');
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
  } catch (emailError) {
    console.error('Failed to send assessment email:', emailError);
    // Don't fail assessment creation if email fails
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Pre-assessment created successfully and email sent to candidate.',
    assessment,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get assessment by ID
 * @route GET /api/v1/pre-assessments/:id
 * @access Private
 */
const getAssessmentById = asyncHandler(async (req, res) => {
  const user = req.user;
  const assessment = await PreAssessment.findById(req.params.id)
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!assessment) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Assessment not found.');
  }

  // Check permissions
  if (user.isCandidate && !user.isAdmin) {
    if (assessment.candidateId._id.toString() !== user.id.toString()) {
      res.status(StatusCodes.FORBIDDEN);
      throw new Error('You do not have permission to access this assessment.');
    }
  }

  // For candidates, hide correct answers if not completed
  const assessmentData = assessment.toObject();
  
  if (user.isCandidate && !user.isAdmin && assessment.status !== 'completed') {
    // Hide correct answers from questions
    assessmentData.questions = assessmentData.questions.map((q) => {
      const questionCopy = { ...q };
      delete questionCopy.correctAnswer;
      return questionCopy;
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Assessment retrieved successfully.',
    assessment: assessmentData,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get assessments for a candidate
 * @route GET /api/v1/pre-assessments/candidate/:candidateId
 * @access Private
 */
const getAssessmentsByCandidate = asyncHandler(async (req, res) => {
  const user = req.user;
  const { candidateId } = req.params;

  // Check permissions
  if (user.isCandidate && !user.isAdmin) {
    if (candidateId !== user.id.toString()) {
      res.status(StatusCodes.FORBIDDEN);
      throw new Error('You can only view your own assessments.');
    }
  }

  const assessments = await PreAssessment.find({ candidateId })
    .populate('jobId', 'title company')
    .populate('applicationId')
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Assessments retrieved successfully.',
    count: assessments.length,
    assessments,
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Start assessment
 * @route POST /api/v1/pre-assessments/:id/start
 * @access Private (Candidate)
 */
const startAssessment = asyncHandler(async (req, res) => {
  const user = req.user;
  const assessment = await PreAssessment.findById(req.params.id);

  if (!assessment) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Assessment not found.');
  }

  // Verify candidate ownership
  if (assessment.candidateId.toString() !== user.id.toString() && !user.isAdmin) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('You do not have permission to start this assessment.');
  }

  // Check if already started or completed
  if (assessment.status === 'completed') {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment has already been completed.');
  }

  if (assessment.status === 'in_progress' && assessment.startedAt) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment is already in progress.');
  }

  // Check if expired
  if (assessment.expiresAt && new Date() > assessment.expiresAt) {
    assessment.status = 'expired';
    await assessment.save();
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment has expired.');
  }

  // Check attempt count
  if (assessment.attemptCount > 0) {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment can only be attempted once.');
  }

  // Start assessment
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + assessment.timeLimit * 60 * 1000);

  assessment.status = 'in_progress';
  assessment.startedAt = startedAt;
  assessment.expiresAt = expiresAt; // Override with time-limit-based expiration
  assessment.attemptCount = 1;
  await assessment.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Assessment started successfully.',
    assessment: {
      ...assessment.toObject(),
      expiresAt,
      timeRemaining: assessment.timeLimit * 60, // in seconds
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Submit assessment answers
 * @route POST /api/v1/pre-assessments/:id/submit
 * @access Private (Candidate)
 */
const submitAssessment = asyncHandler(async (req, res) => {
  const user = req.user;
  const { answers, integrity } = req.body;

  const assessment = await PreAssessment.findById(req.params.id);

  if (!assessment) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Assessment not found.');
  }

  // Verify candidate ownership
  if (assessment.candidateId.toString() !== user.id.toString() && !user.isAdmin) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('You do not have permission to submit this assessment.');
  }

  // Check if assessment is in progress
  if (assessment.status !== 'in_progress') {
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment is not in progress.');
  }

  // Check if expired
  if (assessment.expiresAt && new Date() > assessment.expiresAt) {
    assessment.status = 'expired';
    await assessment.save();
    res.status(StatusCodes.BAD_REQUEST);
    throw new Error('Assessment time has expired.');
  }

  // Update integrity data
  if (integrity) {
    if (integrity.faceDetectionViolations) {
      assessment.integrity.faceDetectionViolations = integrity.faceDetectionViolations;
    }
    if (integrity.tabSwitchCount !== undefined) {
      assessment.integrity.tabSwitchCount = integrity.tabSwitchCount;
    }
    if (integrity.tabSwitchTimestamps) {
      assessment.integrity.tabSwitchTimestamps = integrity.tabSwitchTimestamps;
    }
  }

  // Save answers
  assessment.answers = answers || [];
  assessment.submittedAt = new Date();
  assessment.status = 'completed';
  assessment.isCompleted = true;

  // Calculate score
  const { score, totalPoints, percentage, results } = assessment.calculateScore();
  assessment.score = score;
  assessment.totalPoints = totalPoints;
  assessment.percentage = percentage;
  assessment.results = results;

  // Check plagiarism for coding answers
  const plagiarismPromises = [];
  assessment.questions.forEach((question) => {
    if (question.type === 'coding') {
      const answer = assessment.answers.find((a) => a.questionId === question.questionId);
      if (answer && answer.answer) {
        plagiarismPromises.push(
          checkPlagiarism(answer.answer, question.questionId).then((result) => ({
            questionId: question.questionId,
            ...result,
            checkedAt: new Date(),
          }))
        );
      }
    }
  });

  const plagiarismResults = await Promise.all(plagiarismPromises);
  assessment.integrity.plagiarismScores = plagiarismResults;

  await assessment.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Assessment submitted successfully.',
    assessment: {
      ...assessment.toObject(),
      score,
      totalPoints,
      percentage,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Log integrity violations during assessment
 * @route POST /api/v1/pre-assessments/:id/integrity
 * @access Private (Candidate)
 */
const logIntegrityViolation = asyncHandler(async (req, res) => {
  const user = req.user;
  const { type, violationType } = req.body;

  const assessment = await PreAssessment.findById(req.params.id);

  if (!assessment) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Assessment not found.');
  }

  // Verify candidate ownership
  if (assessment.candidateId.toString() !== user.id.toString() && !user.isAdmin) {
    res.status(StatusCodes.FORBIDDEN);
    throw new Error('You do not have permission to log violations for this assessment.');
  }

  if (type === 'face_detection') {
    assessment.integrity.faceDetectionViolations.push({
      type: violationType, // 'no_face' or 'multiple_faces'
      timestamp: new Date(),
    });
  } else if (type === 'tab_switch') {
    assessment.integrity.tabSwitchCount += 1;
    assessment.integrity.tabSwitchTimestamps.push(new Date());
  }

  await assessment.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Integrity violation logged.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @desc Get assessment results
 * @route GET /api/v1/pre-assessments/:id/results
 * @access Private
 */
const getAssessmentResults = asyncHandler(async (req, res) => {
  const user = req.user;
  const assessment = await PreAssessment.findById(req.params.id)
    .populate('candidateId', 'firstName lastName email')
    .populate('jobId', 'title company')
    .populate('applicationId');

  if (!assessment) {
    res.status(StatusCodes.NOT_FOUND);
    throw new Error('Assessment not found.');
  }

  // Check permissions
  if (user.isCandidate && !user.isAdmin) {
    if (assessment.candidateId._id.toString() !== user.id.toString()) {
      res.status(StatusCodes.FORBIDDEN);
      throw new Error('You do not have permission to view these results.');
    }
  }

  const assessmentData = assessment.toObject();

  // For candidates, only show score
  if (user.isCandidate && !user.isAdmin) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assessment results retrieved successfully.',
      results: {
        score: assessment.score,
        totalPoints: assessment.totalPoints,
        percentage: assessment.percentage,
        status: assessment.status,
        submittedAt: assessment.submittedAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // For recruiters/admins, show full results with integrity data
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Assessment results retrieved successfully.',
    results: {
      score: assessment.score,
      totalPoints: assessment.totalPoints,
      percentage: assessment.percentage,
      status: assessment.status,
      submittedAt: assessment.submittedAt,
      integrity: {
        faceDetectionViolations: assessment.integrity.faceDetectionViolations.length,
        tabSwitchCount: assessment.integrity.tabSwitchCount,
        plagiarismScores: assessment.integrity.plagiarismScores,
      },
      detailedResults: assessment.results,
      assessment: assessmentData,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createPreAssessment,
  getAssessmentById,
  getAssessmentsByCandidate,
  startAssessment,
  submitAssessment,
  logIntegrityViolation,
  getAssessmentResults,
};

