const { Router } = require('express');

const {
  protectServer,
  authorizeServerRoles,
} = require('../middlewares/auth.middleware');

const {
  createInterview,
  getAllInterviews,
  getInterviewById,
  getInterviewsByJobId,
  updateInterview,
  deleteInterview,
} = require('../controllers/interview.controller');

const router = Router();

router
  .route('/')
  // SIMPLIFIED: Allow both recruiters and interviewers to create interviews
  .post(protectServer, authorizeServerRoles('isRecruiter', 'isInterviewer'), createInterview)
  .get(protectServer, getAllInterviews);

router
  .route('/:id')
  .get(protectServer, getInterviewById)
  // SIMPLIFIED: Allow recruiters, interviewers, and admins to update interviews
  .put(
    protectServer,
    authorizeServerRoles('isRecruiter', 'isInterviewer', 'isAdmin'),
    updateInterview
  )
  // SIMPLIFIED: Allow recruiters, interviewers, and admins to cancel interviews
  .delete(protectServer, authorizeServerRoles('isRecruiter', 'isInterviewer', 'isAdmin'), deleteInterview);

router
  .route('/job/:jobId')
  .get(
    protectServer,
    authorizeServerRoles('isInterviewer', 'isRecruiter', 'isAdmin'),
    getInterviewsByJobId
  );

module.exports = router;
