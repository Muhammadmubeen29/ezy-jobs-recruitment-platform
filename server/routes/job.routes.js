const { Router } = require('express');

const {
  protectServer,
  authorizeServerRoles,
} = require('../middlewares/auth.middleware');

const {
  createJob,
  getAllJobs,
  getJobById,
  updateJobById,
  deleteJobById,
} = require('../controllers/job.controller');

const router = Router();

router
  .route('/')
  .post(protectServer, authorizeServerRoles('isRecruiter'), createJob)
  .get(getAllJobs); // getAllJobs handles role-based filtering internally

router
  .route('/:id')
  .get(getJobById)
  .patch(
    protectServer,
    authorizeServerRoles('isRecruiter', 'isAdmin'),
    updateJobById
  )
  .delete(protectServer, authorizeServerRoles('isRecruiter', 'isAdmin'), deleteJobById);

module.exports = router;
