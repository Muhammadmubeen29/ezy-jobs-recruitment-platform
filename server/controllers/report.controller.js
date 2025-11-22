const asyncHandler = require('express-async-handler');
const { StatusCodes } = require('http-status-codes');

const {
  User,
  Job,
  Application,
  Contract,
  Transaction,
  Interview,
} = require('../models');

/**
 * @desc Get user activity report
 *
 * @route GET /api/v1/reports/user-activity
 * @access Private (Admin)
 *
 * @params {startDate, endDate} - Optional date range for the report
 *
 * @returns {Object} - User activity report containing user statistics, trends, and top interviewers
 */
const getUserActivityReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Default to last 30 days if no dates provided
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Total users by role
    const usersByRole = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$isAdmin', true] },
              'Admin',
              {
                $cond: [
                  { $eq: ['$isRecruiter', true] },
                  'Recruiter',
                  {
                    $cond: [
                      { $eq: ['$isInterviewer', true] },
                      'Interviewer',
                      'Candidate'
                    ]
                  }
                ]
              }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Registration trend
    const registrationTrend = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          registrations: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Verification stats
    const verificationStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$isVerified', true] },
              'Verified',
              'Unverified'
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top interviewers by rating
    const topInterviewers = await User.aggregate([
      {
        $match: {
          isInterviewer: true,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'interviewerratings',
          localField: '_id',
          foreignField: 'interviewerId',
          as: 'ratings'
        }
      },
      {
        $addFields: {
          avgRating: { $avg: '$ratings.rating' },
          totalRatings: { $size: '$ratings' }
        }
      },
      {
        $match: {
          totalRatings: { $gt: 0 }
        }
      },
      {
        $sort: { avgRating: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          avgRating: 1,
          totalRatings: 1
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'User activity report generated successfully',
      data: {
        period: { start, end },
        usersByRole,
        registrationTrend,
        verificationStats,
        topInterviewers
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate user activity report: ${error.message}`);
  }
});

/**
 * @desc Get job performance report (alias for job analytics)
 *
 * @route GET /api/v1/reports/job-performance
 * @access Private (Admin)
 *
 * @params {startDate, endDate} - Optional date range for the report
 *
 * @returns {Object} - Job performance report
 */
const getJobPerformanceReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Jobs by category
    const jobsByCategory = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$category',
          jobCount: { $sum: 1 }
        }
      },
      {
        $sort: { jobCount: -1 }
      }
    ]);

    // Job posting trend
    const jobPostingTrend = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          jobsPosted: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Popular jobs (most applications)
    const popularJobs = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'applications',
          localField: '_id',
          foreignField: 'jobId',
          as: 'applications'
        }
      },
      {
        $addFields: {
          applicationCount: { $size: '$applications' }
        }
      },
      {
        $sort: { applicationCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          title: 1,
          company: 1,
          category: 1,
          applicationCount: 1
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Job analytics report generated successfully',
      data: {
        period: { start, end },
        jobsByCategory,
        jobPostingTrend,
        popularJobs
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate job analytics report: ${error.message}`);
  }
});

/**
 * @desc Get financial report
 *
 * @route GET /api/v1/reports/financial
 * @access Private (Admin)
 *
 * @params {startDate, endDate} - Optional date range for the report
 *
 * @returns {Object} - Financial report
 */
const getFinancialReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Revenue by transaction type
    const revenueByType = await Transaction.aggregate([
      {
        $match: {
          transactionDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          transactionCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPlatformFee: { $sum: '$platformFee' }
        }
      }
    ]);

    // Revenue trend
    const revenueTrend = await Transaction.aggregate([
      {
        $match: {
          transactionDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' }
          },
          dailyRevenue: { $sum: '$amount' },
          dailyPlatformFee: { $sum: '$platformFee' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Contract statistics
    const contractStats = await Contract.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          contractCount: { $sum: 1 },
          avgContractValue: { $avg: '$agreedPrice' },
          totalContractValue: { $sum: '$agreedPrice' }
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Financial report generated successfully',
      data: {
        period: { start, end },
        revenueByType,
        revenueTrend,
        contractStats: contractStats[0] || {
          contractCount: 0,
          avgContractValue: 0,
          totalContractValue: 0
        }
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate financial report: ${error.message}`);
  }
});

/**
 * @desc Get interview analytics report
 *
 * @route GET /api/v1/reports/interview-analytics
 * @access Private (Admin)
 *
 * @params {startDate, endDate} - Optional date range for the report
 *
 * @returns {Object} - Interview analytics report
 */
const getInterviewAnalyticsReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Interview status statistics
    const interviewStatusStats = await Interview.aggregate([
      {
        $match: {
          scheduledTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Interview trends
    const interviewTrends = await Interview.aggregate([
      {
        $match: {
          scheduledTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' }
          },
          scheduledCount: { $sum: 1 },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Interview analytics report generated successfully',
      data: {
        period: { start, end },
        interviewStatusStats,
        interviewTrends
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate interview analytics report: ${error.message}`);
  }
});

/**
 * @desc Get application funnel report
 *
 * @route GET /api/v1/reports/application-funnel
 * @access Private (Admin)
 *
 * @params {startDate, endDate} - Optional date range for the report
 *
 * @returns {Object} - Application funnel report
 */
const getApplicationFunnelReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  try {
    // Application status statistics
    const funnelStats = await Application.aggregate([
      {
        $match: {
          applicationDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Application trends
    const applicationTrends = await Application.aggregate([
      {
        $match: {
          applicationDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$applicationDate' }
            },
            status: '$status'
          },
          applications: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Application funnel report generated successfully',
      data: {
        period: { start, end },
        funnelStats,
        applicationTrends
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
    throw new Error(`Failed to generate application funnel report: ${error.message}`);
  }
});

module.exports = {
  getUserActivityReport,
  getJobPerformanceReport,
  getFinancialReport,
  getInterviewAnalyticsReport,
  getApplicationFunnelReport,
};