import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { FaClock, FaExclamationTriangle, FaVideo, FaVideoSlash } from 'react-icons/fa';

import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import {
  useGetAssessmentByIdQuery,
  useStartAssessmentMutation,
  useSubmitAssessmentMutation,
  useLogIntegrityViolationMutation,
} from '../../features/assessment/assessmentApi';
import { useSelector } from 'react-redux';

export default function AssessmentScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [integrity, setIntegrity] = useState({
    faceDetectionViolations: [],
    tabSwitchCount: 0,
    tabSwitchTimestamps: [],
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const faceCheckIntervalRef = useRef(null);
  const tabSwitchTimestampRef = useRef(Date.now());

  const {
    data: assessmentData,
    isLoading: assessmentLoading,
    error: assessmentError,
  } = useGetAssessmentByIdQuery(id);

  const [startAssessment, { isLoading: starting }] = useStartAssessmentMutation();
  const [submitAssessment, { isLoading: submitting }] = useSubmitAssessmentMutation();
  const [logIntegrityViolation] = useLogIntegrityViolationMutation();

  const assessment = assessmentData?.assessment;

  // Start webcam and face detection
  useEffect(() => {
    if (!assessment || assessment.status !== 'in_progress') return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setWebcamActive(true);
        }

        // Simple face detection check (periodic validation)
        // In production, use face-api.js or MediaPipe for proper face detection
        faceCheckIntervalRef.current = setInterval(() => {
          checkFacePresence();
        }, 5000); // Check every 5 seconds

        // Initial face check
        setTimeout(checkFacePresence, 2000);
      } catch (error) {
        console.error('Error accessing webcam:', error);
        logViolation('face_detection', 'no_face');
        setWebcamActive(false);
      }
    };

    const checkFacePresence = () => {
      if (!videoRef.current || !streamRef.current) {
        logViolation('face_detection', 'no_face');
        setFaceDetected(false);
        return;
      }

      // Simplified face detection - check if video is playing and has content
      // In production, integrate proper face detection library
      const video = videoRef.current;
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Basic validation - video stream is active
        // For production: use face-api.js to detect actual faces
        const hasContent = video.videoWidth > 0 && video.videoHeight > 0;
        setFaceDetected(hasContent);

        if (!hasContent) {
          logViolation('face_detection', 'no_face');
        }
      } else {
        logViolation('face_detection', 'no_face');
        setFaceDetected(false);
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (faceCheckIntervalRef.current) {
        clearInterval(faceCheckIntervalRef.current);
      }
    };
  }, [assessment?.status]);

  // Tab switch detection
  useEffect(() => {
    if (!assessment || assessment.status !== 'in_progress') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        const timeSinceLastSwitch = now - tabSwitchTimestampRef.current;
        
        // Only log if it's been more than 2 seconds (avoid multiple rapid logs)
        if (timeSinceLastSwitch > 2000) {
          setIntegrity((prev) => ({
            ...prev,
            tabSwitchCount: prev.tabSwitchCount + 1,
            tabSwitchTimestamps: [...prev.tabSwitchTimestamps, new Date()],
          }));

          logViolation('tab_switch');
          setWarningCount((prev) => prev + 1);
          tabSwitchTimestampRef.current = now;
        }
      }
    };

    const handleBlur = () => {
      handleVisibilityChange();
    };

    const handleFocus = () => {
      tabSwitchTimestampRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [assessment?.status]);

  // Timer countdown
  useEffect(() => {
    if (!assessment || assessment.status !== 'in_progress' || !assessment.expiresAt) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(assessment.expiresAt);
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      return diff;
    };

    setTimeRemaining(calculateTimeRemaining());

    timerIntervalRef.current = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === 0) {
        handleAutoSubmit();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [assessment?.status, assessment?.expiresAt]);

  const logViolation = async (type, violationType = null) => {
    try {
      await logIntegrityViolation({
        id,
        type,
        violationType,
      }).unwrap();
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  };

  const handleStartAssessment = async () => {
    try {
      await startAssessment(id).unwrap();
    } catch (error) {
      console.error('Failed to start assessment:', error);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAutoSubmit = async () => {
    if (submitting) return;
    await handleSubmit();
  };

  const handleSubmit = async () => {
    if (!assessment) return;

    try {
      // Prepare answers in required format
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
        submittedAt: new Date(),
      }));

      await submitAssessment({
        id,
        answers: answersArray,
        integrity,
      }).unwrap();

      // Navigate to results page
      navigate(`/assessment/${id}/results`);
    } catch (error) {
      console.error('Failed to submit assessment:', error);
    }
  };

  if (assessmentLoading || starting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (assessmentError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert
          message={assessmentError?.data?.message || 'Failed to load assessment.'}
          isSuccess={false}
        />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert message="Assessment not found." isSuccess={false} />
      </div>
    );
  }

  // If assessment is pending, show start screen
  if (assessment.status === 'pending') {
    return (
      <>
        <Helmet>
          <title>Pre-Assessment - EZYJOBS</title>
        </Helmet>
        <div className="flex min-h-screen items-center justify-center bg-light-background p-4 dark:bg-dark-background">
          <div className="w-full max-w-2xl rounded-xl bg-light-surface p-8 shadow-lg dark:bg-dark-surface">
            <h1 className="mb-4 text-3xl font-bold text-light-text dark:text-dark-text">
              Pre-Assessment Instructions
            </h1>
            <div className="mb-6 space-y-4 text-light-text/80 dark:text-dark-text/80">
              <p>
                Welcome to your pre-assessment test. Please read the following instructions carefully before starting.
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>Time Limit: {assessment.timeLimit} minutes</li>
                <li>Attempts: Single attempt only</li>
                <li>You must have webcam access enabled</li>
                <li>Do not switch browser tabs during the assessment</li>
                <li>Ensure your face is visible in the camera</li>
              </ul>
              <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                <p className="flex items-start text-yellow-800 dark:text-yellow-300">
                  <FaExclamationTriangle className="mr-2 mt-1" />
                  <span>
                    <strong>Important:</strong> Any violations detected (tab switching, no face detected, etc.) will be logged and may affect your assessment results.
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={handleStartAssessment}
              disabled={starting}
              className="w-full rounded bg-light-primary px-6 py-3 text-white transition-all hover:bg-light-secondary disabled:opacity-50 dark:bg-dark-primary dark:hover:bg-dark-secondary"
            >
              {starting ? 'Starting...' : 'Start Assessment'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // If assessment is completed, redirect to results
  if (assessment.status === 'completed') {
    navigate(`/assessment/${id}/results`);
    return null;
  }

  // Assessment in progress
  const currentQuestion = assessment.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / assessment.questions.length) * 100;

  return (
    <>
      <Helmet>
        <title>Assessment in Progress - EZYJOBS</title>
      </Helmet>
      <div className="min-h-screen bg-light-background dark:bg-dark-background">
        {/* Header with timer and warnings */}
        <div className="sticky top-0 z-10 border-b border-light-border bg-light-surface shadow-sm dark:border-dark-border dark:bg-dark-surface">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <FaClock className="text-light-primary dark:text-dark-primary" />
                  <span className={`font-mono text-lg font-bold ${timeRemaining < 300 ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {webcamActive ? (
                    <>
                      {faceDetected ? (
                        <FaVideo className="text-green-500" />
                      ) : (
                        <FaVideoSlash className="text-red-500" />
                      )}
                    </>
                  ) : (
                    <FaVideoSlash className="text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {warningCount > 0 && (
                  <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                    <FaExclamationTriangle />
                    <span>{warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="text-sm text-light-text/70 dark:text-dark-text/70">
                  Question {currentQuestionIndex + 1} of {assessment.questions.length}
                </div>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
              <div
                className="h-full rounded-full bg-light-primary transition-all dark:bg-dark-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Webcam preview (small, top-right corner) */}
        {assessment.status === 'in_progress' && (
          <div className="fixed right-4 top-20 z-20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-32 w-32 rounded-lg border-2 border-light-border object-cover dark:border-dark-border"
              style={{ display: webcamActive ? 'block' : 'none' }}
            />
          </div>
        )}

        {/* Main content */}
        <div className="mx-auto max-w-4xl px-4 py-8">
          {warningCount >= 3 && (
            <Alert
              message="Multiple violations detected. Continued violations may result in assessment disqualification."
              isSuccess={false}
            />
          )}

          {currentQuestion && (
            <div className="rounded-xl bg-light-surface p-6 shadow-md dark:bg-dark-surface">
              <div className="mb-4">
                <span className="rounded bg-light-primary px-3 py-1 text-sm font-medium text-white dark:bg-dark-primary">
                  {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Coding Task'}
                </span>
                <span className="ml-2 text-sm text-light-text/70 dark:text-dark-text/70">
                  {currentQuestion.points} points
                </span>
              </div>

              <h2 className="mb-6 text-2xl font-bold text-light-text dark:text-dark-text">
                {currentQuestion.question}
              </h2>

              {currentQuestion.type === 'mcq' ? (
                <div className="space-y-3">
                  {currentQuestion.options?.map((option, index) => (
                    <label
                      key={index}
                      className={`flex cursor-pointer items-center rounded-lg border-2 p-4 transition-all ${
                        answers[currentQuestion.questionId] === option
                          ? 'border-light-primary bg-light-primary/10 dark:border-dark-primary dark:bg-dark-primary/10'
                          : 'border-light-border hover:border-light-primary/50 dark:border-dark-border dark:hover:border-dark-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.questionId}`}
                        value={option}
                        checked={answers[currentQuestion.questionId] === option}
                        onChange={(e) => handleAnswerChange(currentQuestion.questionId, e.target.value)}
                        className="mr-3 h-4 w-4"
                      />
                      <span className="text-light-text dark:text-dark-text">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <textarea
                    value={answers[currentQuestion.questionId] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.questionId, e.target.value)}
                    placeholder="Write your code solution here..."
                    className="min-h-[300px] w-full rounded-lg border border-light-border bg-light-background p-4 font-mono text-sm text-light-text focus:border-light-primary focus:outline-none dark:border-dark-border dark:bg-dark-background dark:text-dark-text dark:focus:border-dark-primary"
                  />
                  {currentQuestion.testCases && currentQuestion.testCases.length > 0 && (
                    <div className="mt-4 rounded-lg bg-light-background p-4 dark:bg-dark-background">
                      <h3 className="mb-2 font-semibold text-light-text dark:text-dark-text">
                        Test Cases:
                      </h3>
                      <ul className="list-disc space-y-1 pl-6 text-sm text-light-text/70 dark:text-dark-text/70">
                        {currentQuestion.testCases.map((testCase, idx) => (
                          <li key={idx}>
                            Input: {testCase.input} → Expected: {testCase.expectedOutput}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="rounded bg-light-border px-6 py-2 text-light-text transition-all hover:bg-light-border/80 disabled:opacity-50 dark:bg-dark-border dark:text-dark-text dark:hover:bg-dark-border/80"
            >
              Previous
            </button>
            <div className="space-x-4">
              {currentQuestionIndex < assessment.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="rounded bg-light-primary px-6 py-2 text-white transition-all hover:bg-light-secondary dark:bg-dark-primary dark:hover:bg-dark-secondary"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded bg-green-600 px-6 py-2 text-white transition-all hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

