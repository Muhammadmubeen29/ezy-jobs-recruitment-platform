import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaCalendarAlt, FaPencilAlt, FaSave, FaTimes } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import Alert from '../../components/Alert';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import Table from '../../components/ui/dashboardLayout/Table';
import InputField from '../../components/ui/mainLayout/InputField';

import { trackEvent, trackPageView } from '../../utils/analytics';

import {
  useGetAllApplicationsQuery,
  useUpdateApplicationMutation,
} from '../../features/application/applicationApi';
import { useCreateInterviewMutation } from '../../features/interview/interviewApi';
import { useGetInterviewersQuery } from '../../features/user/userApi';

export default function CandidateApplicationsScreen() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  // FIXED: Use ref to persist application data even if state updates
  const selectedApplicationRef = useRef(null);
  const [status, setStatus] = useState('');
  // Interview scheduling form state
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [meetingType, setMeetingType] = useState('Online');
  const [notes, setNotes] = useState('');

  const location = useLocation();
  const { userInfo } = useSelector((state) => state.auth);

  const {
    data: applications,
    isLoading: isApplicationsLoading,
    error,
    refetch,
  } = useGetAllApplicationsQuery({
    role: 'recruiter',
  });
  // Backend automatically filters by recruiter's jobs - no need to pass recruiterId

  const [
    updateApplication,
    {
      isLoading: isUpdating,
      error: updateError,
      data: updatedApplication,
      isSuccess,
    },
  ] = useUpdateApplicationMutation();

  // Fetch interviewers for dropdown using the new endpoint
  const { 
    data: interviewersData, 
    isLoading: isInterviewersLoading,
    error: interviewersError 
  } = useGetInterviewersQuery(undefined, {
    // Skip if user is not authenticated or is not a recruiter/admin
    skip: !userInfo || (!userInfo.isRecruiter && !userInfo.isAdmin)
  });
  
  // Extract interviewers array from response (backend returns { interviewers: [...] })
  const interviewers = interviewersData?.interviewers || interviewersData?.data?.interviewers || [];

  // Create interview mutation
  const [
    createInterview,
    {
      isLoading: isCreatingInterview,
      error: createInterviewError,
      isSuccess: isInterviewCreated,
      data: createdInterview,
    },
  ] = useCreateInterviewMutation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  // REMOVED: This useEffect was causing the update modal to open automatically
  // whenever selectedApplication changed, which interfered with the schedule modal.
  // Now the update modal only opens when handleUpdateStatus is explicitly called.

  const handleUpdateStatus = (application) => {
    setSelectedApplication(application);
    setStatus(application.status);
    setShowUpdateModal(true);
    trackEvent(
      'Open Update Status Modal',
      'User Action',
      `User opened update status modal for application ID: ${application.id}`
    );
  };

  const handleScheduleInterview = (application) => {
    // FIXED: Store the application properly and ensure update modal is closed
    console.log('Opening schedule modal for application:', application);
    // Store in both state and ref for persistence
    setSelectedApplication(application);
    selectedApplicationRef.current = application;
    setShowScheduleModal(true);
    // Make sure update modal is closed when opening schedule modal
    setShowUpdateModal(false);
    // Reset form
    setScheduledDate('');
    setScheduledTime('');
    setInterviewerId('');
    setMeetingType('Online');
    setNotes('');
    trackEvent(
      'Open Schedule Interview Modal',
      'User Action',
      `User opened schedule interview modal for application ID: ${application.id || application._id}`
    );
  };

  const handleCreateInterview = async () => {
    // FIXED: Use ref as fallback if state is cleared - this ensures we always have the application
    const application = selectedApplication || selectedApplicationRef.current;
    
    // CRASH FIX: Check if application exists - prevent null reference error
    if (!application) {
      console.error('Cannot schedule interview: No application selected');
      console.error('State:', selectedApplication);
      console.error('Ref:', selectedApplicationRef.current);
      alert('Please select an application first. Close this modal and try clicking "Schedule Interview" again.');
      return;
    }
    
    // Restore application to state if it was cleared
    if (!selectedApplication && application) {
      console.log('Restoring application to state from ref');
      setSelectedApplication(application);
    }

    if (!scheduledDate || !scheduledTime || !interviewerId) {
      console.error('Missing required fields:', { scheduledDate, scheduledTime, interviewerId });
      return;
    }

    try {
      // FIXED: Extract IDs properly - handle both object and string formats
      // Use the stored application variable to avoid null reference
      const candidateId = application?.candidate?._id || 
                         application?.candidate?.id || 
                         application?.candidateId?._id ||
                         application?.candidateId ||
                         application?.candidateId?.toString?.();
      
      const jobId = application?.job?._id || 
                   application?.job?.id || 
                   application?.jobId?._id ||
                   application?.jobId ||
                   application?.jobId?.toString?.();
      
      const applicationId = application?._id || 
                           application?.id ||
                           application?._id?.toString?.();
      
      // Validate that we have all required IDs
      if (!candidateId || !jobId || !applicationId) {
        console.error('Missing required IDs:', { 
          candidateId, 
          jobId, 
          applicationId, 
          application,
          candidate: application?.candidate,
          job: application?.job
        });
        throw new Error('Invalid application data. Please refresh the page and try again.');
      }

      // Debug logging to help identify issues
      console.log('Creating interview with data:', {
        scheduledDate,
        scheduledTimeString: scheduledTime,
        candidateId,
        jobId,
        applicationId,
        interviewerId,
        meetingType,
        notes,
        fullApplication: application, // Include full object for debugging
      });

      await createInterview({
        scheduledDate,
        scheduledTimeString: scheduledTime,
        candidateId,
        jobId,
        applicationId,
        interviewerId,
        meetingType,
        notes,
      }).unwrap();

      setShowScheduleModal(false);
      setSelectedApplication(null);
      selectedApplicationRef.current = null; // Clear ref as well
      // Reset form fields
      setScheduledDate('');
      setScheduledTime('');
      setInterviewerId('');
      setMeetingType('Online');
      setNotes('');
      refetch();
      trackEvent(
        'Schedule Interview',
        'User Action',
        'User successfully scheduled an interview'
      );
    } catch (err) {
      console.error('Schedule interview failed:', err);
      // FIXED: Error is now displayed in the modal via createInterviewError
      trackEvent(
        'Schedule Interview Failed',
        'User Action',
        `Error: ${err?.data?.message || err?.message || 'Unknown error'}`
      );
    }
  };

  const updateApplicationStatus = async () => {
    try {
      await updateApplication({
        id: selectedApplication.id,
        applicationData: { status },
      }).unwrap();

      setShowUpdateModal(false);
      setSelectedApplication(null);
      refetch();
      trackEvent(
        'Update Application Status',
        'User Action',
        `User updated application status to ${status}`
      );
    } catch (err) {
      console.error('Update failed:', err);
      trackEvent(
        'Update Application Status Failed',
        'User Action',
        `User failed to update application status`
      );
    }
  };

  const columns = [
    {
      key: 'jobTitle',
      label: 'Job Title',
      render: (application) => (
        <span className="font-medium text-light-text dark:text-dark-text">
          {application.job.title}
        </span>
      ),
    },
    {
      key: 'companyName',
      label: 'Company Name',
      render: (application) => (
        <span className="text-light-text/70 dark:text-dark-text/70">
          {application.job.company}
        </span>
      ),
    },
    {
      key: 'candidateName',
      label: 'Candidate',
      render: (application) => (
        <span className="text-light-text dark:text-dark-text">
          {application.candidate?.firstName && application.candidate?.lastName
            ? `${application.candidate.firstName} ${application.candidate.lastName}`
            : 'Unknown Candidate'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (application) => application.job.category,
    },
    {
      key: 'status',
      label: 'Status',
      render: (application) => (
        <span
          className={`rounded px-2.5 py-0.5 text-xs font-medium ${
            application.status === 'applied'
              ? 'bg-blue-100 text-blue-800'
              : application.status === 'shortlisted'
                ? 'bg-green-100 text-green-800'
                : application.status === 'hired'
                  ? 'bg-teal-100 text-teal-800'
                  : application.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
          }`}
        >
          {application.status.charAt(0).toUpperCase() +
            application.status.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: 'applicationDate',
      label: 'Applied On',
      render: (application) => (
        <span className="text-light-text/70 dark:text-dark-text/70">
          {new Date(application.applicationDate).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const actions = [
    {
      onClick: handleUpdateStatus,
      render: () => (
        <button className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600">
          <FaPencilAlt />
          Update Status
        </button>
      ),
    },
    {
      onClick: handleScheduleInterview,
      render: () => (
        <button 
          className="flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-white transition-all duration-200 hover:bg-green-600 active:scale-95"
          title="Schedule an interview for this candidate"
        >
          <FaCalendarAlt />
          Schedule Interview
        </button>
      ),
    },
  ];

  const isLoading = isApplicationsLoading || isUpdating;

  return (
    <>
      <Helmet>
        <title>
          Review Applications - OptaHire | AI-Powered Candidate Screening
        </title>
        <meta
          name="description"
          content="Review candidate applications with AI-powered screening on OptaHire. Access top-quality matches for your job openings."
        />
        <meta
          name="keywords"
          content="OptaHire Review Applications, AI Candidate Screening, Top Candidates, Application Review, Smart Hiring"
        />
      </Helmet>

      <section className="flex min-h-screen animate-fadeIn flex-col items-center bg-light-background px-4 py-24 dark:bg-dark-background">
        {isLoading ? (
          <div className="relative w-full max-w-sm animate-fadeIn sm:max-w-md">
            <Loader />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-7xl animate-slideUp">
            <h1 className="mb-6 text-center text-3xl font-bold text-light-text dark:text-dark-text sm:text-4xl md:text-5xl">
              Review{' '}
              <span className="text-light-primary dark:text-dark-primary">
                Applications
              </span>
            </h1>
            <p className="mb-8 text-center text-lg text-light-text/70 dark:text-dark-text/70">
              Review AI-screened candidate applications and discover the perfect
              matches for your job openings.
            </p>

            {error && <Alert message={error.data?.message} />}
            {updateError && <Alert message={updateError.data?.message} />}
            {isSuccess && (
              <Alert
                message={updatedApplication?.message}
                isSuccess={isSuccess}
              />
            )}

            <Table
              columns={columns}
              actions={actions}
              data={applications?.applications || []}
            />
          </div>
        )}
      </section>

      <Modal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedApplication(null);
        }}
        title="Update Application Status"
      >
        {isUpdating ? (
          <Loader />
        ) : (
          <div className="space-y-4">
            {updateError && <Alert message={updateError.data?.message} />}
            {isSuccess && (
              <Alert
                type="success"
                message="Application status updated successfully!"
              />
            )}

            {selectedApplication && (
              <div className="mb-4 rounded bg-gray-50 p-4 dark:bg-gray-800">
                <p className="font-medium text-light-text dark:text-dark-text">
                  <span className="text-light-primary dark:text-dark-primary">
                    Job:
                  </span>{' '}
                  {selectedApplication.job?.title}
                </p>
                <p className="text-light-text/70 dark:text-dark-text/70">
                  <span className="font-medium">Candidate:</span>{' '}
                  {selectedApplication.candidate?.firstName &&
                  selectedApplication.candidate?.lastName
                    ? `${selectedApplication.candidate.firstName} ${selectedApplication.candidate.lastName}`
                    : 'Unknown Candidate'}
                </p>
              </div>
            )}

            <InputField
              id="status"
              type="select"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'applied', label: 'Applied' },
                { value: 'shortlisted', label: 'Shortlisted' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'hired', label: 'Hired' },
              ]}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <button
                className="flex items-center gap-2 rounded bg-gray-300 px-4 py-2 text-gray-800 transition-all duration-200 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedApplication(null);
                }}
                disabled={isUpdating}
              >
                <FaTimes />
                Cancel
              </button>
              <button
                className="flex items-center gap-2 rounded bg-light-primary px-4 py-2 text-white transition-all duration-200 hover:bg-light-secondary dark:bg-dark-primary dark:hover:bg-dark-secondary"
                onClick={updateApplicationStatus}
                disabled={isUpdating}
              >
                <FaSave />
                Update Status
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => {
          // FIXED: Don't clear selectedApplication if we're currently creating an interview
          if (!isCreatingInterview) {
            setShowScheduleModal(false);
            setSelectedApplication(null);
            selectedApplicationRef.current = null; // Clear ref as well
          }
        }}
        title="Schedule Interview"
      >
        {isCreatingInterview ? (
          <Loader />
        ) : (
          <div className="space-y-4">
            {createInterviewError && (
              <Alert 
                message={
                  createInterviewError.data?.message || 
                  createInterviewError.message || 
                  'Failed to schedule interview. Please check all fields and try again.'
                } 
              />
            )}
            {isInterviewCreated && (
              <Alert
                type="success"
                message="Interview scheduled successfully!"
              />
            )}

            {selectedApplication && (
              <div className="mb-4 rounded bg-gray-50 p-4 dark:bg-gray-800">
                <p className="font-medium text-light-text dark:text-dark-text">
                  <span className="text-light-primary dark:text-dark-primary">
                    Job:
                  </span>{' '}
                  {selectedApplication.job?.title}
                </p>
                <p className="text-light-text/70 dark:text-dark-text/70">
                  <span className="font-medium">Candidate:</span>{' '}
                  {selectedApplication.candidate?.firstName &&
                  selectedApplication.candidate?.lastName
                    ? `${selectedApplication.candidate.firstName} ${selectedApplication.candidate.lastName}`
                    : 'Unknown Candidate'}
                </p>
              </div>
            )}

            <div>
              <InputField
                id="interviewer"
                type="select"
                label="Interviewer *"
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                options={[
                  { value: '', label: isInterviewersLoading ? 'Loading interviewers...' : 'Select an interviewer...' },
                  ...interviewers.map((interviewer) => ({
                    value: interviewer.id || interviewer._id,
                    label: `${interviewer.firstName} ${interviewer.lastName} (${interviewer.email})`,
                  })),
                ]}
                disabled={isInterviewersLoading}
              />
              {interviewersError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Failed to load interviewers. Please refresh the page or contact support.
                </p>
              )}
              {!isInterviewersLoading && !interviewersError && interviewers.length === 0 && (
                <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                  No interviewers available. Please contact admin to add interviewers.
                </p>
              )}
            </div>

            <InputField
              id="scheduledDate"
              type="date"
              label="Date *"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />

            <InputField
              id="scheduledTime"
              type="time"
              label="Time *"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />

            <InputField
              id="meetingType"
              type="select"
              label="Meeting Type *"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              options={[
                { value: 'Online', label: 'Online' },
                { value: 'On-site', label: 'On-site' },
                { value: 'Phone', label: 'Phone' },
              ]}
            />

            <InputField
              id="notes"
              type="textarea"
              label="Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <button
                className="flex items-center gap-2 rounded bg-gray-300 px-4 py-2 text-gray-800 transition-all duration-200 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedApplication(null);
                  selectedApplicationRef.current = null; // Clear ref as well
                }}
                disabled={isCreatingInterview}
              >
                <FaTimes />
                Cancel
              </button>
              <button
                className="flex items-center gap-2 rounded bg-green-500 px-4 py-2 text-white transition-all duration-200 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreateInterview}
                disabled={
                  isCreatingInterview || 
                  !scheduledDate || 
                  !scheduledTime || 
                  !interviewerId || 
                  (!selectedApplication && !selectedApplicationRef.current) ||
                  isInterviewersLoading ||
                  interviewers.length === 0
                }
                title={
                  (!selectedApplication && !selectedApplicationRef.current)
                    ? 'Please select an application first'
                    : !scheduledDate
                    ? 'Please select a date'
                    : !scheduledTime
                    ? 'Please select a time'
                    : !interviewerId
                    ? 'Please select an interviewer'
                    : isInterviewersLoading
                    ? 'Loading interviewers...'
                    : interviewers.length === 0
                    ? 'No interviewers available'
                    : ''
                }
              >
                <FaCalendarAlt />
                {isCreatingInterview ? 'Scheduling...' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
