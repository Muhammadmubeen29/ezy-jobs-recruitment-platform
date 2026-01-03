import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaChartBar } from 'react-icons/fa';

import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import {
  useGetAssessmentResultsQuery,
  useGetAssessmentByIdQuery,
} from '../../features/assessment/assessmentApi';
import { useSelector } from 'react-redux';

export default function AssessmentResultsScreen() {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);

  const {
    data: resultsData,
    isLoading: resultsLoading,
    error: resultsError,
  } = useGetAssessmentResultsQuery(id);

  const {
    data: assessmentData,
    isLoading: assessmentLoading,
  } = useGetAssessmentByIdQuery(id);

  const results = resultsData?.results;
  const assessment = assessmentData?.assessment;
  const isRecruiter = user?.isRecruiter || user?.isAdmin;

  if (resultsLoading || assessmentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (resultsError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert
          message={resultsError?.data?.message || 'Failed to load assessment results.'}
          isSuccess={false}
        />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert message="Results not found." isSuccess={false} />
      </div>
    );
  }

  const percentage = results.percentage || 0;
  const score = results.score || 0;
  const totalPoints = results.totalPoints || 0;

  return (
    <>
      <Helmet>
        <title>Assessment Results - EZYJOBS</title>
      </Helmet>
      <div className="min-h-screen bg-light-background py-12 dark:bg-dark-background">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-4xl font-bold text-light-text dark:text-dark-text">
              Assessment Results
            </h1>
            {assessment?.jobId && (
              <p className="text-lg text-light-text/70 dark:text-dark-text/70">
                {assessment.jobId.title} - {assessment.jobId.company}
              </p>
            )}
          </div>

          {/* Score Card */}
          <div className="mb-8 rounded-xl bg-light-surface p-8 shadow-lg dark:bg-dark-surface">
            <div className="flex items-center justify-center space-x-4 mb-6">
              <FaChartBar className="text-4xl text-light-primary dark:text-dark-primary" />
              <div>
                <div className="text-5xl font-bold text-light-text dark:text-dark-text">
                  {percentage.toFixed(1)}%
                </div>
                <div className="text-lg text-light-text/70 dark:text-dark-text/70">
                  Score: {score} / {totalPoints}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-4 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
              <div
                className={`h-full rounded-full transition-all ${
                  percentage >= 70
                    ? 'bg-green-500'
                    : percentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="text-center">
              {percentage >= 70 ? (
                <p className="text-green-600 dark:text-green-400">
                  Excellent! You passed the assessment.
                </p>
              ) : percentage >= 50 ? (
                <p className="text-yellow-600 dark:text-yellow-400">
                  Good attempt. Results are under review.
                </p>
              ) : (
                <p className="text-red-600 dark:text-red-400">
                  Keep practicing! You can improve.
                </p>
              )}
            </div>
          </div>

          {/* Integrity Report (for recruiters/admins only) */}
          {isRecruiter && results.integrity && (
            <div className="mb-8 rounded-xl bg-light-surface p-6 shadow-md dark:bg-dark-surface">
              <h2 className="mb-4 text-2xl font-bold text-light-text dark:text-dark-text">
                Integrity Report
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-light-border p-4 dark:border-dark-border">
                  <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                    Face Detection Violations
                  </div>
                  <div className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">
                    {results.integrity.faceDetectionViolations || 0}
                  </div>
                </div>
                <div className="rounded-lg border border-light-border p-4 dark:border-dark-border">
                  <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                    Tab Switches
                  </div>
                  <div className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">
                    {results.integrity.tabSwitchCount || 0}
                  </div>
                </div>
                <div className="rounded-lg border border-light-border p-4 dark:border-dark-border">
                  <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                    Plagiarism Risk
                  </div>
                  <div className="mt-2 text-2xl font-bold text-light-text dark:text-dark-text">
                    {results.integrity.plagiarismScores?.some((s) => s.similarityScore > 40)
                      ? 'High'
                      : 'Low'}
                  </div>
                </div>
              </div>

              {/* Plagiarism details */}
              {results.integrity.plagiarismScores &&
                results.integrity.plagiarismScores.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 font-semibold text-light-text dark:text-dark-text">
                      Plagiarism Scores by Question:
                    </h3>
                    <ul className="space-y-2">
                      {results.integrity.plagiarismScores.map((score, idx) => (
                        <li
                          key={idx}
                          className={`rounded p-2 ${
                            score.similarityScore > 40
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : 'bg-green-50 dark:bg-green-900/20'
                          }`}
                        >
                          Question {idx + 1}: {score.similarityScore.toFixed(1)}% similarity
                          {score.similarityScore > 40 && (
                            <span className="ml-2 text-red-600 dark:text-red-400">⚠️ Flagged</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Detailed Results (for recruiters/admins only) */}
          {isRecruiter && results.detailedResults && (
            <div className="rounded-xl bg-light-surface p-6 shadow-md dark:bg-dark-surface">
              <h2 className="mb-4 text-2xl font-bold text-light-text dark:text-dark-text">
                Detailed Results
              </h2>
              <div className="space-y-4">
                {results.detailedResults.map((result, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border-2 p-4 ${
                      result.isCorrect
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center space-x-2">
                          {result.isCorrect ? (
                            <FaCheckCircle className="text-green-600 dark:text-green-400" />
                          ) : (
                            <FaTimesCircle className="text-red-600 dark:text-red-400" />
                          )}
                          <span className="font-semibold text-light-text dark:text-dark-text">
                            Question {index + 1}
                          </span>
                          <span className="text-sm text-light-text/70 dark:text-dark-text/70">
                            ({result.pointsAwarded} / {assessment?.questions?.[index]?.points || 0} points)
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div>
                            <strong>Candidate Answer:</strong>{' '}
                            <span className="text-light-text/80 dark:text-dark-text/80">
                              {result.candidateAnswer || 'No answer provided'}
                            </span>
                          </div>
                          {result.correctAnswer && result.correctAnswer !== 'N/A' && (
                            <div>
                              <strong>Correct Answer:</strong>{' '}
                              <span className="text-light-text/80 dark:text-dark-text/80">
                                {result.correctAnswer}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate view (score only) */}
          {!isRecruiter && (
            <div className="rounded-xl bg-light-surface p-6 shadow-md dark:bg-dark-surface">
              <p className="text-center text-light-text/70 dark:text-dark-text/70">
                Your assessment has been submitted. The recruiting team will review your results and contact you soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

