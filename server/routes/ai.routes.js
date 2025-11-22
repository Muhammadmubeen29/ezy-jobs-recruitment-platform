const { Router } = require('express');

const {
  protectServer,
  authorizeServerRoles,
} = require('../middlewares/auth.middleware');

const {
  checkSystemHealth,
  checkAiServiceStatus,
  getModelStatus,
  getModelMetrics,
  trainModel,
  shortlistCandidates,
  previewCandidateShortlist,
} = require('../controllers/ai.controller');

const router = Router();

router.get(
  '/health/system',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  checkSystemHealth
);

router.get(
  '/health/ai-service',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  checkAiServiceStatus
);

router.get(
  '/model/status',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  getModelStatus
);

router.get(
  '/model/metrics',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  getModelMetrics
);

router.post(
  '/model/train',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  trainModel
);

// Define preview route before the parameterized route to avoid accidental
// matching of the literal 'preview' as a jobId (Express matches routes in order).
router.post(
  '/shortlist/preview',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  previewCandidateShortlist
);

router.post(
  '/shortlist/:jobId',
  protectServer,
  authorizeServerRoles('isAdmin', 'isRecruiter'),
  shortlistCandidates
);

module.exports = router;
