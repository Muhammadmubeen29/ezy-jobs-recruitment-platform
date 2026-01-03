const { Router } = require('express');

const {
  protectServer,
  authorizeServerRoles,
} = require('../middlewares/auth.middleware');

const {
  createPreAssessment,
  getAssessmentById,
  getAssessmentsByCandidate,
  startAssessment,
  submitAssessment,
  logIntegrityViolation,
  getAssessmentResults,
} = require('../controllers/preAssessment.controller');

const router = Router();

// Create assessment (called internally after shortlisting)
router.post(
  '/',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  createPreAssessment
);

// Get assessment by ID
router.get(
  '/:id',
  protectServer,
  getAssessmentById
);

// Get assessments by candidate
router.get(
  '/candidate/:candidateId',
  protectServer,
  getAssessmentsByCandidate
);

// Start assessment
router.post(
  '/:id/start',
  protectServer,
  authorizeServerRoles('isCandidate'),
  startAssessment
);

// Submit assessment
router.post(
  '/:id/submit',
  protectServer,
  authorizeServerRoles('isCandidate'),
  submitAssessment
);

// Log integrity violation
router.post(
  '/:id/integrity',
  protectServer,
  authorizeServerRoles('isCandidate'),
  logIntegrityViolation
);

// Get assessment results
router.get(
  '/:id/results',
  protectServer,
  getAssessmentResults
);

module.exports = router;

